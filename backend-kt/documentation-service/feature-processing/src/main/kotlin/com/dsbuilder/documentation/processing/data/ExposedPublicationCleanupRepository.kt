package com.dsbuilder.documentation.processing.data

import com.dsbuilder.documentation.processing.application.PublicationCleanupRepository
import com.dsbuilder.documentation.processing.domain.PublicationCleanupClaim
import com.dsbuilder.documentation.processing.domain.PublicationCleanupFailureClass
import com.dsbuilder.documentation.processing.domain.PublicationCleanupPolicy
import com.dsbuilder.documentation.processing.domain.PublicationCleanupQueueDiagnostics
import com.dsbuilder.documentation.processing.domain.PublicationCleanupTarget
import com.dsbuilder.documentation.processing.domain.StoredObjectDescriptor
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.jetbrains.exposed.v1.core.IntegerColumnType
import org.jetbrains.exposed.v1.core.VarCharColumnType
import org.jetbrains.exposed.v1.core.statements.StatementType
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.JdbcTransaction
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import java.sql.ResultSet
import java.time.Duration
import java.time.Instant

/** PostgreSQL-адаптер устойчивой очереди очистки публикаций. */
class ExposedPublicationCleanupRepository(
    private val database: Database,
    private val publicationBucket: String,
) : PublicationCleanupRepository {
    init {
        require(publicationBucket.isNotBlank()) { "publicationBucket must not be blank" }
    }

    override suspend fun claim(
        workerId: String,
        policy: PublicationCleanupPolicy,
    ): PublicationCleanupClaim? = dbTransaction {
        exec(
            """
                WITH candidate AS (
                    SELECT publication_id
                    FROM publication_cleanup_jobs
                    WHERE (state = 'pending' AND eligible_at <= now())
                       OR (state = 'retry_wait' AND next_attempt_at <= now())
                       OR (state = 'leased' AND lease_until <= now())
                    ORDER BY COALESCE(next_attempt_at, eligible_at), created_at, publication_id
                    FOR UPDATE SKIP LOCKED
                    LIMIT 1
                )
                UPDATE publication_cleanup_jobs job
                SET state = 'leased', lease_owner = ?,
                    lease_until = now() + make_interval(secs => ?),
                    attempt = attempt + 1, next_attempt_at = NULL, updated_at = now()
                FROM candidate
                WHERE job.publication_id = candidate.publication_id
                RETURNING job.publication_id, job.lease_owner, job.lease_until, job.attempt
            """.trimIndent(),
            args = listOf(
                VarCharColumnType(128) to workerId,
                IntegerColumnType() to policy.leaseDuration.seconds.toPositiveSeconds(),
            ),
            explicitStatementType = StatementType.SELECT,
        ) { result -> if (result.next()) result.toCleanupClaim() else null }
    }

    override suspend fun heartbeat(claim: PublicationCleanupClaim, leaseDuration: Duration): Boolean = dbTransaction {
        exec(
            """
                UPDATE publication_cleanup_jobs
                SET lease_until = now() + make_interval(secs => ?), updated_at = now()
                WHERE publication_id = ? AND state = 'leased' AND lease_owner = ?
                  AND attempt = ? AND lease_until > now()
                RETURNING publication_id
            """.trimIndent(),
            args = listOf(
                IntegerColumnType() to leaseDuration.seconds.toPositiveSeconds(),
                VarCharColumnType(80) to claim.publicationId,
                VarCharColumnType(128) to claim.leaseOwner,
                IntegerColumnType() to claim.attempt,
            ),
            explicitStatementType = StatementType.SELECT,
        ) { it.next() } ?: false
    }

    override suspend fun target(claim: PublicationCleanupClaim): PublicationCleanupTarget? = dbTransaction {
        val rawBundle = exec(
            """
                SELECT bundle.storage_bucket, bundle.storage_key, bundle.compressed_size
                FROM publication_cleanup_jobs job
                JOIN documentation_publications publication ON publication.id = job.publication_id
                JOIN documentation_bundles bundle ON bundle.id = publication.bundle_id
                WHERE job.publication_id = ? AND job.state = 'leased' AND job.lease_owner = ?
                  AND job.attempt = ? AND job.lease_until > now()
                  AND publication.status = 'superseded'
                  AND NOT EXISTS (
                      SELECT 1 FROM active_documentation_publications active
                      WHERE active.publication_id = publication.id
                  )
            """.trimIndent(),
            args = claim.arguments(),
            explicitStatementType = StatementType.SELECT,
        ) { result ->
            if (result.next()) {
                StoredObjectDescriptor(
                    result.getString("storage_bucket"),
                    result.getString("storage_key"),
                    result.getLong("compressed_size"),
                )
            } else {
                null
            }
        } ?: return@dbTransaction null

        val publicationObjects = exec(
            """
                SELECT storage_key, max(size) AS size
                FROM (
                    SELECT storage_key, size FROM documentation_content WHERE publication_id = ?
                    UNION ALL
                    SELECT storage_key, size FROM documentation_assets WHERE publication_id = ?
                    UNION ALL
                    SELECT storage_key, size FROM structured_artifacts WHERE publication_id = ?
                ) publication_objects
                GROUP BY storage_key
                ORDER BY storage_key
            """.trimIndent(),
            args = List(3) { VarCharColumnType(80) to claim.publicationId },
            explicitStatementType = StatementType.SELECT,
        ) { result ->
            buildList {
                while (result.next()) {
                    add(
                        StoredObjectDescriptor(
                            publicationBucket,
                            result.getString("storage_key"),
                            result.getLong("size"),
                        ),
                    )
                }
            }
        }.orEmpty()
        PublicationCleanupTarget(claim, publicationObjects, rawBundle)
    }

    override suspend fun scheduleRetry(
        claim: PublicationCleanupClaim,
        failureClass: PublicationCleanupFailureClass,
        nextAttemptAt: Instant,
    ): Boolean = transitionOwned(
        claim,
        """
            state = 'retry_wait', lease_owner = NULL, lease_until = NULL,
            next_attempt_at = ?::timestamptz, last_failure_class = ?, updated_at = now()
        """.trimIndent(),
        listOf(
            VarCharColumnType(64) to nextAttemptAt.toString(),
            VarCharColumnType(32) to failureClass.name.lowercase(),
        ),
    )

    override suspend fun block(
        claim: PublicationCleanupClaim,
        reason: PublicationCleanupFailureClass,
    ): Boolean = transitionOwned(
        claim,
        """
            state = 'blocked', lease_owner = NULL, lease_until = NULL,
            next_attempt_at = NULL, last_failure_class = ?, updated_at = now()
        """.trimIndent(),
        listOf(VarCharColumnType(32) to reason.name.lowercase()),
    )

    override suspend fun complete(claim: PublicationCleanupClaim, deletedAt: Instant): Boolean = dbTransaction {
        val bundleId = exec(
            """
                SELECT publication.bundle_id
                FROM publication_cleanup_jobs job
                JOIN documentation_publications publication ON publication.id = job.publication_id
                WHERE job.publication_id = ? AND job.state = 'leased' AND job.lease_owner = ?
                  AND job.attempt = ? AND job.lease_until > now()
                  AND publication.status = 'superseded'
                  AND NOT EXISTS (
                      SELECT 1 FROM active_documentation_publications active
                      WHERE active.publication_id = publication.id
                  )
                FOR UPDATE OF job, publication
            """.trimIndent(),
            args = claim.arguments(),
            explicitStatementType = StatementType.SELECT,
        ) { result -> if (result.next()) result.getString("bundle_id") else null }
            ?: return@dbTransaction false

        exec(
            "UPDATE documentation_bundles SET storage_deleted_at = ?::timestamptz WHERE id = ?",
            args = listOf(
                VarCharColumnType(64) to deletedAt.toString(),
                VarCharColumnType(80) to bundleId,
            ),
        )
        exec(
            "DELETE FROM documentation_publications WHERE id = ? RETURNING id",
            args = listOf(VarCharColumnType(80) to claim.publicationId),
            explicitStatementType = StatementType.SELECT,
        ) { it.next() } ?: false
    }

    override suspend fun diagnostics(): PublicationCleanupQueueDiagnostics = dbTransaction {
        exec(
            """
                SELECT count(*) AS queue_size,
                    COALESCE(EXTRACT(EPOCH FROM now() - MIN(
                        CASE
                            WHEN state = 'pending' AND eligible_at <= now() THEN eligible_at
                            WHEN state = 'retry_wait' AND next_attempt_at <= now() THEN next_attempt_at
                            WHEN state = 'leased' AND lease_until <= now() THEN lease_until
                        END
                    )), 0)::bigint AS oldest_ready_age_seconds,
                    count(*) FILTER (WHERE state = 'leased' AND lease_until <= now()) AS expired_leases
                FROM publication_cleanup_jobs
            """.trimIndent(),
            explicitStatementType = StatementType.SELECT,
        ) { result ->
            check(result.next())
            PublicationCleanupQueueDiagnostics(
                result.getLong("queue_size"),
                result.getLong("oldest_ready_age_seconds").coerceAtLeast(0),
                result.getLong("expired_leases"),
            )
        } ?: error("Cleanup diagnostics query returned no row")
    }

    private suspend fun transitionOwned(
        claim: PublicationCleanupClaim,
        assignments: String,
        values: List<Pair<org.jetbrains.exposed.v1.core.IColumnType<*>, Any?>>,
    ): Boolean = dbTransaction {
        exec(
            """
                UPDATE publication_cleanup_jobs
                SET $assignments
                WHERE publication_id = ? AND state = 'leased' AND lease_owner = ?
                  AND attempt = ? AND lease_until > now()
                RETURNING publication_id
            """.trimIndent(),
            args = values + claim.arguments(),
            explicitStatementType = StatementType.SELECT,
        ) { it.next() } ?: false
    }

    private fun PublicationCleanupClaim.arguments() = listOf(
        VarCharColumnType(80) to publicationId,
        VarCharColumnType(128) to leaseOwner,
        IntegerColumnType() to attempt,
    )

    private suspend fun <T> dbTransaction(block: JdbcTransaction.() -> T): T =
        withContext(Dispatchers.IO) { transaction(database, block) }
}

private fun ResultSet.toCleanupClaim() = PublicationCleanupClaim(
    publicationId = getString("publication_id"),
    leaseOwner = getString("lease_owner"),
    leaseUntil = getTimestamp("lease_until").toInstant(),
    attempt = getInt("attempt"),
)

private fun Long.toPositiveSeconds(): Int = coerceIn(1, Int.MAX_VALUE.toLong()).toInt()
