package com.dsbuilder.ds.app

import org.flywaydb.core.Flyway
import org.flywaydb.core.api.CoreMigrationType
import org.flywaydb.core.api.MigrationState
import org.flywaydb.core.api.MigrationVersion
import java.sql.Connection

/** Регистрирует baseline только для схемы, совпадающей с проверенным эталоном. */
class ExistingDatabaseAdopter(private val fingerprintCalculator: SchemaFingerprintCalculator) {
    /** Проверяет схему [connection] по [expectedFingerprint] и регистрирует baseline [flyway]. */
    fun adopt(connection: Connection, flyway: Flyway, expectedFingerprint: String): Boolean {
        require(expectedFingerprint.matches(Regex("[0-9a-f]{64}"))) { "Expected schema fingerprint is invalid" }
        if (hasFlywayHistory(connection)) {
            checkAppliedMigrationHistory(flyway)
            checkHistoryOrigin(flyway)
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

    private fun checkHistoryOrigin(flyway: Flyway) {
        val applied = flyway.info().applied()
        val baselineVersion = MigrationVersion.fromVersion("1")
        check(applied.filter { it.type == CoreMigrationType.BASELINE }.all { it.version == baselineVersion }) {
            "Unsupported Flyway baseline: adoption requires baseline V1"
        }
        check(
            applied.any {
                it.version == baselineVersion &&
                    (it.type == CoreMigrationType.BASELINE || it.type == CoreMigrationType.SQL)
            },
        ) { "Flyway history must contain baseline V1 or an applied V1 migration" }
        check(
            applied.none {
                it.state == MigrationState.FUTURE_SUCCESS || it.state == MigrationState.FUTURE_FAILED
            },
        ) { "Flyway history contains unsupported future migrations" }
    }

    private fun hasFlywayHistory(connection: Connection): Boolean =
        connection.prepareStatement("SELECT to_regclass('public.flyway_schema_history') IS NOT NULL").use { statement ->
            statement.executeQuery().use { rows -> rows.next() && rows.getBoolean(1) }
        }
}
