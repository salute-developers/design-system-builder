package com.dsbuilder.ds.app

import org.flywaydb.core.Flyway
import java.sql.DriverManager

/** Controlled operator entrypoint for adopting a matching pre-Flyway database. */
object AdoptExistingDatabase {
    /** Executes the controlled existing-schema adoption procedure. */
    @JvmStatic
    fun main(args: Array<String>) {
        val environment = System.getenv()
        val configuration = DsServiceConfiguration.fromEnvironment(environment)
        val expectedFingerprint = requireNotNull(environment["DS_EXPECTED_SCHEMA_SHA256"]) {
            "DS_EXPECTED_SCHEMA_SHA256 is required"
        }
        val flyway = Flyway.configure()
            .dataSource(configuration.databaseUrl, configuration.databaseUser, configuration.databasePassword)
            .locations("classpath:db/migration")
            .baselineVersion("1")
            .baselineDescription("verified db-service schema")
            .load()
        DriverManager.getConnection(
            configuration.databaseUrl,
            configuration.databaseUser,
            configuration.databasePassword,
        ).use { connection ->
            ExistingDatabaseAdopter(SchemaFingerprintCalculator()).adopt(connection, flyway, expectedFingerprint)
        }
    }
}
