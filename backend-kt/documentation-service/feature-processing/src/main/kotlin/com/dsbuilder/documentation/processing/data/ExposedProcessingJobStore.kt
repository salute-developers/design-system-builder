package com.dsbuilder.documentation.processing.data

import com.dsbuilder.documentation.ingestion.domain.IngestionFailure
import com.dsbuilder.documentation.ingestion.domain.IngestionJob
import com.dsbuilder.documentation.ingestion.domain.IngestionProgress
import com.dsbuilder.documentation.ingestion.domain.IngestionStatus
import com.dsbuilder.documentation.processing.application.AtomicPublicationStore
import com.dsbuilder.documentation.processing.application.ClaimedIngestionJob
import com.dsbuilder.documentation.processing.application.ProcessingFailure
import com.dsbuilder.documentation.processing.application.ProcessingJobStore
import com.dsbuilder.documentation.publication.domain.ProcessingDiagnostic
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.jetbrains.exposed.v1.core.IntegerColumnType
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.core.VarCharColumnType
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.greater
import org.jetbrains.exposed.v1.core.statements.StatementType
import org.jetbrains.exposed.v1.core.statements.UpdateStatement
import org.jetbrains.exposed.v1.javatime.CurrentTimestamp
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.JdbcTransaction
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.jetbrains.exposed.v1.jdbc.update
import java.sql.ResultSet
import java.time.Duration
import java.util.UUID

/** PostgreSQL/Exposed queue repository с короткими lease-транзакциями. */
class ExposedProcessingJobStore(
    private val database: Database,
) : ProcessingJobStore, AtomicPublicationStore {
    override suspend fun claim(
        workerId: String,
        leaseDuration: Duration,
        maxAttempts: Int,
    ): ClaimedIngestionJob? = dbTransaction {
        require(maxAttempts > 0) { "maxAttempts must be positive" }
        failExhaustedJobs(maxAttempts)
        val sql = """
            WITH candidate AS (
                SELECT id
                FROM ingestion_jobs
                WHERE attempt < ?
                  AND (
                      status = 'accepted'
                      OR (status IN ('validating', 'normalizing', 'chunking', 'indexing', 'publishing')
                          AND lease_until < now())
                  )
                ORDER BY created_at, id
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            UPDATE ingestion_jobs AS job
            SET status = 'validating', current_step = 'validating',
                publication_id = COALESCE(publication_id, gen_random_uuid()::text),
                worker_id = ?,
                lease_until = now() + make_interval(secs => ?),
                heartbeat_at = now(), started_at = COALESCE(started_at, now()),
                updated_at = now(), attempt = attempt + 1
            FROM candidate
            WHERE job.id = candidate.id
            RETURNING job.*
        """.trimIndent()
        exec(
            sql,
            args = listOf(
                IntegerColumnType() to maxAttempts,
                VarCharColumnType(128) to workerId,
                IntegerColumnType() to leaseDuration.seconds.coerceIn(1, Int.MAX_VALUE.toLong()).toInt(),
            ),
            explicitStatementType = StatementType.SELECT,
        ) { result ->
            if (result.next()) result.toClaim(workerId) else null
        }
    }

    private fun JdbcTransaction.failExhaustedJobs(maxAttempts: Int) {
        exec(
            """
                UPDATE ingestion_jobs
                SET status = 'failed', current_step = 'failed',
                    failure_code = '$ATTEMPTS_EXHAUSTED_CODE',
                    failure_message = '$ATTEMPTS_EXHAUSTED_MESSAGE',
                    failure_retryable = true,
                    finished_at = now(), updated_at = now(),
                    worker_id = NULL, lease_until = NULL
                WHERE attempt >= ?
                  AND (
                      status = 'accepted'
                      OR (status IN ('validating', 'normalizing', 'chunking', 'indexing', 'publishing')
                          AND (lease_until IS NULL OR lease_until < now()))
                  )
            """.trimIndent(),
            args = listOf(IntegerColumnType() to maxAttempts),
        )
    }

    override suspend fun heartbeat(claim: ClaimedIngestionJob, leaseDuration: Duration): Boolean = dbTransaction {
        exec(
            """
                UPDATE ingestion_jobs
                SET lease_until = now() + make_interval(secs => ?), heartbeat_at = now(), updated_at = now()
                WHERE id = ? AND worker_id = ? AND lease_until > now()
                RETURNING id
            """.trimIndent(),
            args = listOf(
                IntegerColumnType() to leaseDuration.seconds.coerceIn(1, Int.MAX_VALUE.toLong()).toInt(),
                VarCharColumnType(80) to claim.job.id,
                VarCharColumnType(128) to claim.workerId,
            ),
            explicitStatementType = StatementType.SELECT,
        ) { it.next() } ?: false
    }

    override suspend fun ownsLease(claim: ClaimedIngestionJob): Boolean = dbTransaction {
        ProcessingJobsTable
            .select(ProcessingJobsTable.id)
            .where {
                (ProcessingJobsTable.id eq claim.job.id) and
                    (ProcessingJobsTable.workerId eq claim.workerId) and
                    (ProcessingJobsTable.leaseUntil greater CurrentTimestamp)
            }
            .limit(1)
            .any()
    }

    override suspend fun transition(claim: ClaimedIngestionJob, status: IngestionStatus): Boolean = dbTransaction {
        updateOwnedJob(claim) {
            it[ProcessingJobsTable.status] = status.dbValue
            it[ProcessingJobsTable.currentStep] = status.dbValue
            it[ProcessingJobsTable.updatedAt] = CurrentTimestamp
        } == 1
    }

    override suspend fun replaceDiagnostics(
        claim: ClaimedIngestionJob,
        diagnostics: List<ProcessingDiagnostic>,
    ): Boolean = dbTransaction {
        if (!leaseOwned(claim)) return@dbTransaction false
        exec(
            "DELETE FROM processing_diagnostics WHERE job_id = ?",
            args = listOf(VarCharColumnType(80) to claim.job.id),
        )
        diagnostics.forEachIndexed { ordinal, diagnostic ->
            exec(
                """
                    INSERT INTO processing_diagnostics (
                        id, job_id, level, code, message, path, artifact_type, subject, details, ordinal
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?
                    )
                """.trimIndent(),
                args = listOf(
                    VarCharColumnType(128) to persistedDiagnosticId(claim.job.id, diagnostic.id, ordinal),
                    VarCharColumnType(80) to claim.job.id,
                    VarCharColumnType(16) to diagnostic.level.name.lowercase(),
                    VarCharColumnType(128) to diagnostic.code,
                    TextColumnType() to diagnostic.message,
                    TextColumnType() to diagnostic.path,
                    VarCharColumnType(64) to diagnostic.artifactType,
                    TextColumnType() to diagnostic.subject,
                    TextColumnType() to diagnostic.details,
                    IntegerColumnType() to ordinal,
                ),
            )
        }
        true
    }

    private fun persistedDiagnosticId(jobId: String, diagnosticId: String, ordinal: Int): String =
        UUID.nameUUIDFromBytes("$jobId\u0000$diagnosticId\u0000$ordinal".toByteArray()).toString()

    override suspend fun fail(claim: ClaimedIngestionJob, failure: ProcessingFailure): Boolean = dbTransaction {
        updateOwnedJob(claim) {
            it[ProcessingJobsTable.status] = IngestionStatus.FAILED.dbValue
            it[ProcessingJobsTable.currentStep] = IngestionStatus.FAILED.dbValue
            it[ProcessingJobsTable.failureCode] = failure.code
            it[ProcessingJobsTable.failureMessage] = failure.message
            it[ProcessingJobsTable.failureRetryable] = failure.retryable
            it[ProcessingJobsTable.finishedAt] = CurrentTimestamp
            it[ProcessingJobsTable.updatedAt] = CurrentTimestamp
            it[ProcessingJobsTable.workerId] = null
            it[ProcessingJobsTable.leaseUntil] = null
        } == 1
    }

    override suspend fun releaseForRetry(
        claim: ClaimedIngestionJob,
        failure: ProcessingFailure,
    ): Boolean = dbTransaction {
        updateOwnedJob(claim) {
            it[ProcessingJobsTable.status] = IngestionStatus.ACCEPTED.dbValue
            it[ProcessingJobsTable.currentStep] = IngestionStatus.ACCEPTED.dbValue
            it[ProcessingJobsTable.failureCode] = failure.code
            it[ProcessingJobsTable.failureMessage] = failure.message
            it[ProcessingJobsTable.failureRetryable] = true
            it[ProcessingJobsTable.updatedAt] = CurrentTimestamp
            it[ProcessingJobsTable.workerId] = null
            it[ProcessingJobsTable.leaseUntil] = null
        } == 1
    }

    @Suppress("LongMethod")
    override suspend fun publish(claim: ClaimedIngestionJob, publicationId: String): Boolean = dbTransaction {
        val sql = """
            WITH owned_job AS (
                SELECT job.id
                FROM ingestion_jobs job
                WHERE job.id = ?
                  AND job.worker_id = ?
                  AND job.lease_until > now()
                FOR UPDATE
            ), candidate AS (
                SELECT publication.*
                FROM documentation_publications publication, owned_job
                WHERE publication.id = ?
                  AND publication.status = 'candidate'
                FOR UPDATE
            ), superseded AS (
                UPDATE documentation_publications publication
                SET status = 'superseded'
                FROM candidate
                WHERE publication.status = 'published'
                  AND publication.id <> candidate.id
                  AND publication.project_id = candidate.project_id
                  AND publication.design_system_id = candidate.design_system_id
                  AND publication.design_system_version = candidate.design_system_version
                  AND publication.platform = candidate.platform
            ), published AS (
                UPDATE documentation_publications publication
                SET status = 'published', published_at = now()
                FROM candidate
                WHERE publication.id = candidate.id
                RETURNING publication.*
            ), pointer AS (
                INSERT INTO active_documentation_publications (
                    project_id, design_system_id, design_system_version, platform, publication_id, activated_at
                )
                SELECT project_id, design_system_id, design_system_version, platform, id, now()
                FROM published
                ON CONFLICT (project_id, design_system_id, design_system_version, platform)
                DO UPDATE SET publication_id = EXCLUDED.publication_id,
                    activated_at = EXCLUDED.activated_at
            )
            UPDATE ingestion_jobs job
            SET status = 'published', current_step = 'published', publication_id = ?,
                progress_completed = progress_total, finished_at = now(), updated_at = now(),
                worker_id = NULL, lease_until = NULL
            FROM published
            WHERE job.id = ?
              AND job.worker_id = ?
              AND job.lease_until > now()
            RETURNING job.id
        """.trimIndent()
        exec(
            sql,
            args = listOf(
                VarCharColumnType(80) to claim.job.id,
                VarCharColumnType(128) to claim.workerId,
                VarCharColumnType(80) to publicationId,
                VarCharColumnType(80) to publicationId,
                VarCharColumnType(80) to claim.job.id,
                VarCharColumnType(128) to claim.workerId,
            ),
            explicitStatementType = StatementType.SELECT,
        ) { it.next() } ?: false
    }

    private fun JdbcTransaction.leaseOwned(claim: ClaimedIngestionJob): Boolean =
        ProcessingJobsTable
            .select(ProcessingJobsTable.id)
            .where {
                (ProcessingJobsTable.id eq claim.job.id) and
                    (ProcessingJobsTable.workerId eq claim.workerId) and
                    (ProcessingJobsTable.leaseUntil greater CurrentTimestamp)
            }
            .forUpdate()
            .limit(1)
            .any()

    private fun updateOwnedJob(
        claim: ClaimedIngestionJob,
        body: ProcessingJobsTable.(UpdateStatement) -> Unit,
    ): Int = ProcessingJobsTable.update(
        where = {
            (ProcessingJobsTable.id eq claim.job.id) and
                (ProcessingJobsTable.workerId eq claim.workerId) and
                (ProcessingJobsTable.leaseUntil greater CurrentTimestamp)
        },
        body = body,
    )

    private suspend fun <T> dbTransaction(block: JdbcTransaction.() -> T): T =
        withContext(Dispatchers.IO) { transaction(database, block) }
}

private fun ResultSet.toClaim(workerId: String): ClaimedIngestionJob {
    val status = IngestionStatus.valueOf(getString("status").uppercase())
    val job = IngestionJob(
        id = getString("id"),
        bundleId = getString("bundle_id"),
        status = status,
        currentStep = IngestionStatus.valueOf(getString("current_step").uppercase()),
        publicationId = getString("publication_id"),
        attempt = getInt("attempt"),
        workerId = getString("worker_id"),
        leaseUntil = getTimestamp("lease_until")?.toInstant(),
        progress = IngestionProgress(
            completedSteps = getInt("progress_completed"),
            totalSteps = getInt("progress_total"),
            processedItems = getLong("progress_processed"),
            totalItems = getLong("progress_items_total").takeUnless { wasNull() },
        ),
        failure = getString("failure_code")?.let { code ->
            IngestionFailure(code, getString("failure_message"), getBoolean("failure_retryable"))
        },
        createdAt = getTimestamp("created_at").toInstant(),
        startedAt = getTimestamp("started_at")?.toInstant(),
        heartbeatAt = getTimestamp("heartbeat_at")?.toInstant(),
        updatedAt = getTimestamp("updated_at").toInstant(),
        finishedAt = getTimestamp("finished_at")?.toInstant(),
    )
    return ClaimedIngestionJob(job, workerId)
}

private val IngestionStatus.dbValue: String get() = name.lowercase()

private const val ATTEMPTS_EXHAUSTED_CODE = "PROCESSING_ATTEMPTS_EXHAUSTED"
private const val ATTEMPTS_EXHAUSTED_MESSAGE = "Documentation processing attempts exhausted"
