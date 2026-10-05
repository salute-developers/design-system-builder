package com.dsbuilder.ds.app

import org.flywaydb.core.Flyway
import java.sql.Connection

/** Explicitly adopts only a schema matching the reviewed baseline fingerprint. */
class ExistingDatabaseAdopter(private val fingerprintCalculator: SchemaFingerprintCalculator) {
    /** Baselines [flyway] only when [connection] matches [expectedFingerprint]. */
    fun adopt(connection: Connection, flyway: Flyway, expectedFingerprint: String): Boolean {
        require(expectedFingerprint.matches(Regex("[0-9a-f]{64}"))) { "Expected schema fingerprint is invalid" }
        if (hasFlywayHistory(connection)) {
            val validation = flyway.validateWithResult()
            val blockingMigrations = validation.invalidMigrations.filterNot { migration ->
                migration.errorDetails.errorMessage.contains("not applied to database")
            }
            check(blockingMigrations.isEmpty()) {
                "Existing Flyway history is invalid: " +
                    blockingMigrations.joinToString { it.errorDetails.errorMessage }
            }
            return false
        }
        val actualFingerprint = fingerprintCalculator.calculate(connection)
        check(actualFingerprint == expectedFingerprint) {
            "Schema fingerprint mismatch: expected=$expectedFingerprint actual=$actualFingerprint"
        }
        flyway.baseline()
        checkAppliedMigrationHistory(flyway)
        return true
    }

    private fun checkAppliedMigrationHistory(flyway: Flyway) {
        val validation = flyway.validateWithResult()
        val blockingMigrations = validation.invalidMigrations.filterNot { migration ->
            migration.errorDetails.errorMessage.contains("not applied to database")
        }
        check(blockingMigrations.isEmpty()) {
            "Existing Flyway history is invalid: ${blockingMigrations.joinToString { it.errorDetails.errorMessage }}"
        }
    }

    private fun hasFlywayHistory(connection: Connection): Boolean =
        connection.prepareStatement("SELECT to_regclass('public.flyway_schema_history') IS NOT NULL").use { statement ->
            statement.executeQuery().use { rows -> rows.next() && rows.getBoolean(1) }
        }
}
