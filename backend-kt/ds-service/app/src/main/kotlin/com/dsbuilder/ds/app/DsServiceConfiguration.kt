package com.dsbuilder.ds.app

/**
 * Environment-backed immutable runtime configuration.
 *
 * @property port Ktor HTTP port
 * @property databaseUrl PostgreSQL JDBC URL
 * @property databaseUser PostgreSQL username
 * @property databasePassword PostgreSQL password
 * @property databasePoolSize maximum Hikari pool size
 * @property databaseConnectionTimeoutMs pool connection timeout
 * @property authorizationPolicyPath optional authorization policy override
 * @property runFlyway whether Flyway migration and validation run at startup
 * @property adoptExistingSchema whether the verified legacy schema is baselined
 * @property expectedSchemaFingerprint reviewed fingerprint required for adoption
 */
data class DsServiceConfiguration(
    val port: Int,
    val databaseUrl: String,
    val databaseUser: String,
    val databasePassword: String,
    val databasePoolSize: Int,
    val databaseConnectionTimeoutMs: Long,
    val authorizationPolicyPath: String?,
    val runFlyway: Boolean,
    val adoptExistingSchema: Boolean,
    val expectedSchemaFingerprint: String?,
) {
    companion object {
        /** Reads and validates the service configuration from [environment]. */
        fun fromEnvironment(environment: Map<String, String> = System.getenv()): DsServiceConfiguration =
            DsServiceConfiguration(
                port = environment["DS_SERVICE_PORT"]?.toIntOrNull() ?: DEFAULT_PORT,
                databaseUrl = environment["DS_DATABASE_URL"]
                    ?: "jdbc:postgresql://localhost:5433/design_system_builder",
                databaseUser = environment["DS_DATABASE_USER"] ?: "postgres",
                databasePassword = environment["DS_DATABASE_PASSWORD"] ?: "postgres",
                databasePoolSize = environment["DS_DATABASE_POOL_SIZE"]?.toIntOrNull() ?: 10,
                databaseConnectionTimeoutMs = environment["DS_DATABASE_CONNECTION_TIMEOUT_MS"]?.toLongOrNull() ?: 5_000,
                authorizationPolicyPath = environment["AUTHORIZATION_POLICY_PATH"],
                runFlyway = environment["DS_FLYWAY_ENABLED"]?.toBooleanStrictOrNull() ?: true,
                adoptExistingSchema = environment["DS_FLYWAY_ADOPT_EXISTING"]?.toBooleanStrictOrNull() ?: false,
                expectedSchemaFingerprint = environment["DS_EXPECTED_SCHEMA_SHA256"],
            )

        private const val DEFAULT_PORT = 8085
    }
}
