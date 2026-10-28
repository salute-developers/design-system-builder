package com.dsbuilder.ds.app

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.application.DraftInvalidationStream
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.data.PostgresDatabasePool
import org.flywaydb.core.api.output.MigrateResult
import org.jetbrains.exposed.v1.jdbc.Database

/**
 * Fully initialized dependencies required by health and feature routes.
 *
 * @property databasePool owned Hikari and Exposed database resources
 * @property evaluator immutable shared authorization evaluator
 * @property accessPolicy application-level authorization adapter
 * @property metrics bounded service metric registry
 * @property migration Flyway migration result when migrations are enabled
 * @property flywayValidated whether startup validation succeeded
 * @property policyCoverageValid whether every manifest permission exists in the immutable policy
 * @property draftInvalidations stream of committed active-draft invalidations
 */
data class DsRuntime(
    val databasePool: PostgresDatabasePool,
    val evaluator: PolicyEvaluator,
    val accessPolicy: DsAccessPolicy,
    val metrics: DsMetrics,
    val migration: MigrateResult?,
    val flywayValidated: Boolean,
    val policyCoverageValid: Boolean,
    val draftInvalidations: DraftInvalidationStream,
    /** Закрываемый ресурс отдельного PostgreSQL `LISTEN`-соединения. */
    val draftInvalidationResource: AutoCloseable,
) : com.dsbuilder.runtime.RuntimeHandle {
    private val closed = java.util.concurrent.atomic.AtomicBoolean()

    override suspend fun readiness(): com.dsbuilder.runtime.RuntimeReadiness {
        val available = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            try {
                org.jetbrains.exposed.v1.jdbc.transactions.transaction(db = database) { exec("SELECT 1") }
                true
            } catch (cancelled: kotlinx.coroutines.CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                false
            }
        }
        val checks = mapOf(
            "database" to available,
            "flyway" to flywayValidated,
            "policyCoverage" to policyCoverageValid,
        )
        return com.dsbuilder.runtime.RuntimeReadiness(checks.values.all { it }, checks)
    }

    override suspend fun stop(gracePeriod: kotlin.time.Duration) = close()

    override fun close() {
        if (closed.compareAndSet(false, true)) {
            try { draftInvalidationResource.close() } finally { databasePool.close() }
        }
    }

    /** Exposed database backed by [databasePool]. */
    val database: Database = databasePool.database
}
