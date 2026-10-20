package com.dsbuilder.ds.app

import org.flywaydb.core.Flyway
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.Connection
import java.sql.DriverManager
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFails
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class FlywayAdoptionIntegrationTest {
    @Test
    fun `transition works on PostgreSQL 16`() = verifyTransition("postgres:16-alpine")

    @Test
    fun `transition works on PostgreSQL 17`() = verifyTransition("postgres:17-alpine")

    private fun verifyTransition(image: String) {
        PostgreSQLContainer<Nothing>(image).use { postgres ->
            postgres.start()
            verifyLegacyUpgrade(postgres)
            verifyFullBaseline(postgres)
            verifyUnsupportedHistory(postgres)
            verifyDriftRejected(postgres)
            verifyConflictRejected(postgres)
            verifyPopulatedRestartAfterBackfill(postgres)
            verifyBackfillFailureRollsBackUpgrade(postgres)
            verifyRestoredSchema(postgres)
        }
    }

    private fun verifyLegacyUpgrade(postgres: PostgreSQLContainer<Nothing>) {
        val url = createDatabase(postgres, "legacy_upgrade")
        connection(url, postgres).use { connection ->
            applySchema(connection)
            assertEquals(BASELINE_FINGERPRINT, fingerprint(connection))
            insertThemes(connection)
            val flyway = flyway(url, postgres)
            assertEquals(6, adoptAndMigrate(connection, flyway))
            assertEquals(FINAL_FINGERPRINT, fingerprint(connection))
            assertEquals(
                "Alpha Theme",
                scalar(connection, "SELECT name FROM tenant_revisions WHERE tenant_id = '$FIRST_THEME'"),
            )
            assertEquals(
                "0",
                scalar(
                    connection,
                    "SELECT count(*) FROM information_schema.columns " +
                        "WHERE table_schema = 'public' AND table_name = 'tenants' " +
                        "AND column_name = 'edit_revision'",
                ),
            )
            assertEquals(
                "2",
                scalar(connection, "SELECT count(*) FROM tenants WHERE design_system_id = '$DESIGN_SYSTEM'"),
            )
            assertEquals("2", scalar(connection, "SELECT count(*) FROM token_values WHERE token_id = '$TOKEN'"))
            assertEquals("7", scalar(connection, "SELECT count(*) FROM flyway_schema_history WHERE success"))
            assertEquals(0, adoptAndMigrate(connection, flyway))
            assertEquals("2", scalar(connection, "SELECT count(*) FROM token_values WHERE token_id = '$TOKEN'"))
            connection.createStatement().use {
                it.execute(
                    "UPDATE flyway_schema_history SET checksum = 0 WHERE version = '2'",
                )
            }
            assertFails { adoptAndMigrate(connection, flyway) }
        }
    }

    private fun verifyFullBaseline(postgres: PostgreSQLContainer<Nothing>) {
        val url = createDatabase(postgres, "full_baseline")
        connection(url, postgres).use { connection ->
            applySchema(connection)
            assertEquals(BASELINE_FINGERPRINT, fingerprint(connection))
            // Represents a restart before baseline adoption.
            assertEquals(6, adoptAndMigrate(connection, flyway(url, postgres)))
            assertEquals(0, adoptAndMigrate(connection, flyway(url, postgres)))
        }
        val pendingUrl = createDatabase(postgres, "baseline_pending")
        connection(pendingUrl, postgres).use { connection ->
            applySchema(connection)
            val flyway = flyway(pendingUrl, postgres)
            ExistingDatabaseAdopter(SchemaFingerprintCalculator()).adopt(
                connection,
                flyway,
                BASELINE_FINGERPRINT,
            )
            assertEquals(6, adoptAndMigrate(connection, flyway))
        }
    }

    private fun verifyUnsupportedHistory(postgres: PostgreSQLContainer<Nothing>) {
        listOf("2", "999").forEach { version ->
            val url = createDatabase(postgres, "wrong_baseline_$version")
            connection(url, postgres).use { connection ->
                applySchema(connection)
                val wrongBaseline = Flyway.configure()
                    .dataSource(url, postgres.username, postgres.password)
                    .locations("classpath:db/migration")
                    .baselineVersion(version)
                    .load()
                wrongBaseline.baseline()
                assertFailsWith<IllegalStateException> {
                    adoptAndMigrate(connection, flyway(url, postgres))
                }
                assertEquals("1", scalar(connection, "SELECT count(*) FROM flyway_schema_history"))
            }
        }
        val url = createDatabase(postgres, "future_history")
        val flyway = flyway(url, postgres)
        assertEquals(7, flyway.migrate().migrationsExecuted)
        connection(url, postgres).use { connection ->
            assertEquals(0, adoptAndMigrate(connection, flyway))
            connection.createStatement().use {
                it.execute(
                    "UPDATE flyway_schema_history SET version = '999', script = 'V999__unknown.sql' " +
                        "WHERE version = '2'",
                )
            }
            assertFails { adoptAndMigrate(connection, flyway) }
            assertEquals(
                "999",
                scalar(connection, "SELECT version FROM flyway_schema_history WHERE installed_rank = 2"),
            )
        }
    }

    private fun verifyDriftRejected(postgres: PostgreSQLContainer<Nothing>) {
        val url = createDatabase(postgres, "drifted")
        connection(url, postgres).use { connection ->
            applySchema(connection)
            connection.createStatement().use { it.execute("ALTER TABLE tenants ADD COLUMN unexpected text") }
            val before = fingerprint(connection)
            val error = assertFailsWith<IllegalStateException> {
                adoptAndMigrate(connection, flyway(url, postgres))
            }
            assertTrue(error.message.orEmpty().contains("Schema fingerprint mismatch"))
            assertEquals(before, fingerprint(connection))
            assertFalse(hasHistory(connection))
        }
        val indexUrl = createDatabase(postgres, "index_drift")
        connection(indexUrl, postgres).use { connection ->
            applySchema(connection)
            connection.createStatement().use { it.execute("DROP INDEX tenants_design_system_id_name_unique") }
            assertFailsWith<IllegalStateException> {
                adoptAndMigrate(connection, flyway(indexUrl, postgres))
            }
            assertFalse(hasHistory(connection))
        }
    }

    private fun verifyConflictRejected(postgres: PostgreSQLContainer<Nothing>) {
        val url = createDatabase(postgres, "conflict")
        connection(url, postgres).use { connection ->
            applySchema(connection)
            insertThemes(connection)
            connection.createStatement().use {
                it.execute(
                    "UPDATE tenants SET name = 'alpha theme' WHERE id = '$SECOND_THEME'",
                )
            }
            val before = fingerprint(connection)
            val error = assertFailsWith<org.flywaydb.core.api.FlywayException> {
                adoptAndMigrate(connection, flyway(url, postgres))
            }
            assertTrue(error.message.orEmpty().contains("Conflicting normalized tenant names"))
            assertEquals(before, fingerprint(connection))
            assertTrue(hasHistory(connection))
            assertEquals("1", scalar(connection, "SELECT count(*) FROM flyway_schema_history"))
            assertEquals(" Alpha  Theme ", scalar(connection, "SELECT name FROM tenants WHERE id = '$FIRST_THEME'"))
            assertEquals("1", scalar(connection, "SELECT count(*) FROM token_values WHERE token_id = '$TOKEN'"))
            connection.createStatement().use {
                it.execute("UPDATE tenants SET name = 'Gamma' WHERE id = '$SECOND_THEME'")
            }
            assertEquals(6, adoptAndMigrate(connection, flyway(url, postgres)))
            assertEquals(FINAL_FINGERPRINT, fingerprint(connection))
            assertEquals(
                "Alpha Theme",
                scalar(connection, "SELECT name FROM tenant_revisions WHERE tenant_id = '$FIRST_THEME'"),
            )
        }
    }

    private fun verifyBackfillFailureRollsBackUpgrade(postgres: PostgreSQLContainer<Nothing>) {
        val url = createDatabase(postgres, "backfill_failure")
        connection(url, postgres).use { connection ->
            applySchema(connection)
            insertThemes(connection)
            val preparationFlyway = flyway(url, postgres, "6")
            assertEquals(5, adoptAndMigrate(connection, preparationFlyway))
            assertEquals("6", scalar(connection, "SELECT count(*) FROM flyway_schema_history WHERE success"))
            connection.createStatement().use {
                it.execute(
                    """
                    CREATE FUNCTION reject_test_backfill() RETURNS trigger LANGUAGE plpgsql AS $$
                    BEGIN RAISE EXCEPTION 'injected backfill failure'; END;
                    $$;
                    CREATE FUNCTION attach_test_backfill_guard() RETURNS event_trigger LANGUAGE plpgsql AS $$
                    BEGIN
                        IF to_regclass('public.token_value_revisions') IS NOT NULL AND NOT EXISTS (
                            SELECT 1 FROM pg_trigger WHERE tgname = 'reject_test_backfill'
                        ) THEN
                            CREATE TRIGGER reject_test_backfill BEFORE INSERT ON token_value_revisions
                            FOR EACH ROW EXECUTE FUNCTION reject_test_backfill();
                        END IF;
                    END;
                    $$;
                    CREATE EVENT TRIGGER attach_test_backfill_guard ON ddl_command_end
                    WHEN TAG IN ('CREATE TABLE') EXECUTE FUNCTION attach_test_backfill_guard();
                    """.trimIndent(),
                )
            }
            val preparedFingerprint = fingerprint(connection)
            val flyway = flyway(url, postgres)
            assertFailsWith<org.flywaydb.core.api.FlywayException> { flyway.migrate() }
            assertEquals(preparedFingerprint, fingerprint(connection))
            assertEquals(
                "0",
                scalar(
                    connection,
                    "SELECT count(*) FROM pg_class WHERE oid = to_regclass('public.token_value_revisions')",
                ),
            )
            assertEquals("6", scalar(connection, "SELECT count(*) FROM flyway_schema_history WHERE success"))
            connection.createStatement().use {
                it.execute(
                    "DROP EVENT TRIGGER attach_test_backfill_guard; " +
                        "DROP FUNCTION attach_test_backfill_guard(); DROP FUNCTION reject_test_backfill();",
                )
            }
            assertEquals(1, adoptAndMigrate(connection, flyway))
            assertEquals(FINAL_FINGERPRINT, fingerprint(connection))
            assertEquals("2", scalar(connection, "SELECT count(*) FROM token_value_revisions"))
        }
    }

    private fun verifyPopulatedRestartAfterBackfill(postgres: PostgreSQLContainer<Nothing>) {
        val url = createDatabase(postgres, "restart_after_backfill")
        connection(url, postgres).use { connection ->
            applySchema(connection)
            insertThemes(connection)
            assertEquals(6, adoptAndMigrate(connection, flyway(url, postgres)))
            assertEquals("7", scalar(connection, "SELECT count(*) FROM flyway_schema_history WHERE success"))
            assertEquals("2", scalar(connection, "SELECT count(*) FROM tenant_revisions"))
            assertEquals("2", scalar(connection, "SELECT count(*) FROM token_value_revisions"))
            assertEquals(
                "1",
                scalar(connection, "SELECT count(*) FROM design_system_versions WHERE status = 'baseline'"),
            )
            assertEquals(
                "1",
                scalar(connection, "SELECT count(*) FROM design_system_versions WHERE status = 'draft'"),
            )
        }
        connection(url, postgres).use { connection ->
            assertEquals(0, adoptAndMigrate(connection, flyway(url, postgres)))
            assertEquals(FINAL_FINGERPRINT, fingerprint(connection))
            assertEquals(
                "Alpha Theme",
                scalar(connection, "SELECT name FROM tenant_revisions WHERE tenant_id = '$FIRST_THEME'"),
            )
            assertEquals("2", scalar(connection, "SELECT count(*) FROM token_values WHERE token_id = '$TOKEN'"))
        }
    }

    private fun verifyRestoredSchema(postgres: PostgreSQLContainer<Nothing>) {
        val sourceUrl = createDatabase(postgres, "dump_source")
        connection(sourceUrl, postgres).use { applySchema(it) }
        val dump = postgres.execInContainer(
            "pg_dump", "-U", postgres.username, "-d", "dump_source",
            "--schema-only", "--schema=public", "--no-owner", "--no-privileges",
        )
        assertEquals(0, dump.exitCode, dump.stderr)
        val restoredUrl = createDatabase(postgres, "restored")
        connection(restoredUrl, postgres).use { connection ->
            val sql = dump.stdout.lines().filterNot { it.startsWith("\\") }.joinToString("\n")
                .replace("CREATE SCHEMA public;", "")
            connection.createStatement().use {
                it.execute(sql)
                // pg_dump clears search_path; a new application connection uses the default path.
                it.execute("RESET search_path")
            }
            assertEquals(BASELINE_FINGERPRINT, fingerprint(connection))
            assertEquals(6, adoptAndMigrate(connection, flyway(restoredUrl, postgres)))
            assertEquals(FINAL_FINGERPRINT, fingerprint(connection))
        }
    }

    private fun insertThemes(connection: Connection) {
        connection.createStatement().use { statement ->
            statement.execute(
                "INSERT INTO design_systems(id, name, project_name) " +
                    "VALUES ('$DESIGN_SYSTEM', 'Fixture', 'fixture')",
            )
            statement.execute(
                """
                INSERT INTO tenants(id, design_system_id, name, created_at) VALUES
                    ('$FIRST_THEME', '$DESIGN_SYSTEM', ' Alpha  Theme ', '2020-01-01'),
                    ('$SECOND_THEME', '$DESIGN_SYSTEM', 'Beta', '2020-01-02')
                """.trimIndent(),
            )
            statement.execute(
                "INSERT INTO tokens(id, design_system_id, name) " +
                    "VALUES ('$TOKEN', '$DESIGN_SYSTEM', 'fixture-token')",
            )
            statement.execute(
                "INSERT INTO token_values(token_id, tenant_id, value) " +
                    "VALUES ('$TOKEN', '$FIRST_THEME', '\"preserved\"'::jsonb)",
            )
        }
    }

    private fun applySchema(connection: Connection) {
        val baseline = requireNotNull(javaClass.getResource("/db/migration/V1__db_service_baseline.sql")).readText()
        val sql = baseline
        sql.split(Regex("--> statement-breakpoint\\s*"))
            .map(String::trim).filter(String::isNotEmpty)
            .forEach { query -> connection.createStatement().use { it.execute(query) } }
    }

    private fun createDatabase(postgres: PostgreSQLContainer<Nothing>, name: String): String {
        connection(postgres.jdbcUrl, postgres).use { connection ->
            connection.createStatement().use { it.execute("CREATE DATABASE $name") }
        }
        return postgres.jdbcUrl.substringBeforeLast('/') + "/$name"
    }

    private fun connection(url: String, postgres: PostgreSQLContainer<Nothing>): Connection =
        DriverManager.getConnection(url, postgres.username, postgres.password)

    private fun flyway(url: String, postgres: PostgreSQLContainer<Nothing>, target: String? = null): Flyway {
        val configuration = Flyway.configure()
            .dataSource(url, postgres.username, postgres.password)
            .locations("classpath:db/migration")
            .baselineVersion("1")
            .baselineDescription("verified db-service schema")
        if (target != null) configuration.target(target)
        return configuration.load()
    }

    private fun fingerprint(connection: Connection): String = SchemaFingerprintCalculator().calculate(connection)

    private fun scalar(connection: Connection, sql: String): String =
        connection.createStatement().use { statement ->
            statement.executeQuery(sql).use { rows ->
                rows.next()
                rows.getString(1)
            }
        }

    private fun hasHistory(connection: Connection): Boolean =
        connection.createStatement().use { statement ->
            statement.executeQuery("SELECT to_regclass('public.flyway_schema_history') IS NOT NULL").use { rows ->
                rows.next()
                rows.getBoolean(1)
            }
        }

    private fun adoptAndMigrate(connection: Connection, flyway: Flyway): Int {
        ExistingDatabaseAdopter(SchemaFingerprintCalculator()).adopt(connection, flyway, BASELINE_FINGERPRINT)
        val executed = flyway.migrate().migrationsExecuted
        assertTrue(flyway.validateWithResult().validationSuccessful)
        return executed
    }

    private companion object {
        const val BASELINE_FINGERPRINT = "7770cff86df2e5b81da0e0461da2f2bec1f3bb7e2c1cfc1afc230b5a3368ea55"
        const val FINAL_FINGERPRINT = "b2ef481cc0b70c0a32c913df0f4111a0fe5baaf4146db7627ccb2ad1e23162ec"
        const val DESIGN_SYSTEM = "11111111-1111-4111-8111-111111111111"
        const val FIRST_THEME = "22222222-2222-4222-8222-222222222222"
        const val SECOND_THEME = "33333333-3333-4333-8333-333333333333"
        const val TOKEN = "44444444-4444-4444-8444-444444444444"
    }
}
