package com.dsbuilder.ds.app

import com.dsbuilder.authorization.PolicyEvaluator
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
 */
data class DsRuntime(
    val databasePool: PostgresDatabasePool,
    val evaluator: PolicyEvaluator,
    val accessPolicy: DsAccessPolicy,
    val metrics: DsMetrics,
    val migration: MigrateResult?,
    val flywayValidated: Boolean,
    val policyCoverageValid: Boolean,
) {
    /** Exposed database backed by [databasePool]. */
    val database: Database = databasePool.database
}
