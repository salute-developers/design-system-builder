package com.dsbuilder.ds.app

import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.data.ExposedTransactionRunner
import com.dsbuilder.ds.core.data.PostgresTransactionFailureMapper
import kotlinx.coroutines.runBlocking
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.Connection
import java.sql.DriverManager
import java.sql.SQLException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class FlywayPostgresIntegrationTest {
    @Test
    fun `baseline migrates empty database adopts matching legacy schema and rejects drift`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            val cleanUrl = postgres.jdbcUrl
            val flyway = flyway(cleanUrl, postgres.username, postgres.password)

            // Отпечаток принятой базы db-service — схема на цели 1: следующие миграции её меняют.
            val baselineUrl = createDatabase(postgres, "baseline_only")
            val baseline = flyway(baselineUrl, postgres.username, postgres.password, target = "1")
            assertEquals(1, baseline.migrate().migrationsExecuted)
            val expected = connection(baselineUrl, postgres).use(SchemaFingerprintCalculator()::calculate)
            assertEquals(EXPECTED_SCHEMA_FINGERPRINT, expected)

            assertEquals(MIGRATION_COUNT, flyway.migrate().migrationsExecuted)
            assertEquals(0, flyway.migrate().migrationsExecuted)
            assertTrue(flyway.validateWithResult().validationSuccessful)
            connection(cleanUrl, postgres).use(::assertComponentImportGuards)
            assertFailureRollsBack(cleanUrl, postgres)

            val matchingUrl = createDatabase(postgres, "matching_legacy")
            connection(matchingUrl, postgres).use(::applyBaselineWithoutHistory)
            connection(matchingUrl, postgres).use(::seedLegacyTheme)
            val matchingFlyway = flyway(matchingUrl, postgres.username, postgres.password)
            connection(matchingUrl, postgres).use { connection ->
                ExistingDatabaseAdopter(SchemaFingerprintCalculator()).adopt(connection, matchingFlyway, expected)
            }
            connection(matchingUrl, postgres).use { assertTrue(hasHistory(it)) }
            assertEquals(MIGRATION_COUNT - 1, matchingFlyway.migrate().migrationsExecuted)
            connection(matchingUrl, postgres).use(::assertThemePaletteBackfill)

            val driftedUrl = createDatabase(postgres, "drifted_legacy")
            connection(driftedUrl, postgres).use { connection ->
                applyBaselineWithoutHistory(connection)
                connection.createStatement().use {
                    it.execute(
                        "ALTER TABLE design_systems ADD COLUMN unexpected_drift text",
                    )
                }
                assertFailsWith<IllegalStateException> {
                    ExistingDatabaseAdopter(SchemaFingerprintCalculator()).adopt(
                        connection,
                        flyway(driftedUrl, postgres.username, postgres.password),
                        expected,
                    )
                }
                assertFalse(hasHistory(connection))
            }
        }
    }

    private fun assertFailureRollsBack(url: String, postgres: PostgreSQLContainer<Nothing>) {
        connection(url, postgres).use { connection ->
            connection.createStatement().use {
                it.execute("CREATE TABLE transaction_probe(value integer NOT NULL UNIQUE)")
                it.execute("INSERT INTO transaction_probe(value) VALUES (2)")
            }
        }
        val database = Database.connect(url, user = postgres.username, password = postgres.password)
        val result = runBlocking {
            ExposedTransactionRunner(database, PostgresTransactionFailureMapper()).required<Unit> {
                TransactionManager.current().exec("INSERT INTO transaction_probe(value) VALUES (1)")
                DsResult.Failure(DsFailure.Unprocessable("probe", "probe"))
            }
        }
        assertTrue(result is DsResult.Failure)
        val conflict = runBlocking {
            ExposedTransactionRunner(database, PostgresTransactionFailureMapper()).required<Unit> {
                TransactionManager.current().exec("INSERT INTO transaction_probe(value) VALUES (2)")
                DsResult.Success(Unit)
            }
        }
        assertTrue((conflict as DsResult.Failure).error is DsFailure.Conflict)
        connection(url, postgres).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery("SELECT count(*) FROM transaction_probe").use { rows ->
                    assertTrue(rows.next())
                    assertEquals(1, rows.getInt(1))
                }
            }
        }
    }

    /** Тема и общая палитра в базе db-service до принятия Flyway. */
    private fun seedLegacyTheme(connection: Connection) {
        connection.createStatement().use { statement ->
            statement.execute(
                "INSERT INTO design_systems (id, name, project_name) " +
                    "VALUES ('11111111-1111-4111-8111-111111111111', 'legacy', 'legacy')",
            )
            statement.execute(
                "INSERT INTO tenants (id, design_system_id, name) VALUES " +
                    "('22222222-2222-4222-8222-222222222222', " +
                    "'11111111-1111-4111-8111-111111111111', 'legacy_default')",
            )
            statement.execute(
                "INSERT INTO palette (type, shade, saturation, value) VALUES " +
                    "('general', 'green', 500, '#1A9E32'), ('general', 'green', 600, '#108E28'), " +
                    "('additional', 'h130', 500, '#12A12F')",
            )
        }
    }

    /** V3 даёт существующей теме копию общей палитры и пять системных групп. */
    private fun assertThemePaletteBackfill(connection: Connection) {
        fun count(sql: String) = connection.createStatement().use { statement ->
            statement.executeQuery(sql).use { rows ->
                rows.next()
                rows.getInt(1)
            }
        }
        val tenant = "'22222222-2222-4222-8222-222222222222'"
        assertEquals(3, count("SELECT count(*) FROM tenant_palette_template WHERE tenant_id = $tenant"))
        assertEquals(
            5,
            count("SELECT count(*) FROM tenant_palette_groups WHERE tenant_id = $tenant AND kind = 'system'"),
        )
        assertEquals(
            1,
            count("SELECT count(*) FROM tenant_palette_groups WHERE system_key = 'status' AND label = 'Статус'"),
        )
    }

    private fun applyBaselineWithoutHistory(connection: Connection) {
        val sql = requireNotNull(javaClass.getResource("/db/migration/V1__db_service_baseline.sql")).readText()
        sql.split(Regex("--> statement-breakpoint\\s*"))
            .map(String::trim)
            .filter(String::isNotEmpty)
            .forEach { statement -> connection.createStatement().use { it.execute(statement) } }
    }

    private fun assertComponentImportGuards(connection: Connection) {
        assertFailsWith<SQLException> {
            connection.createStatement().use {
                it.execute("DELETE FROM state_sets WHERE id = '00000000-0000-4000-8000-0000000000ff'")
            }
        }
        assertFailsWith<SQLException> {
            connection.createStatement().use { it.execute("TRUNCATE states") }
        }
        assertFailsWith<SQLException> {
            connection.createStatement().use {
                it.execute("INSERT INTO state_sets(state_ids) VALUES (ARRAY[gen_random_uuid()])")
            }
        }
        connection.createStatement().use { statement ->
            statement.executeQuery(
                """
                INSERT INTO state_sets(state_ids)
                VALUES (ARRAY[
                    '00000000-0000-4000-8000-000000000002'::uuid,
                    '00000000-0000-4000-8000-000000000001'::uuid,
                    '00000000-0000-4000-8000-000000000002'::uuid
                ])
                RETURNING state_ids::text
                """.trimIndent(),
            ).use { rows ->
                assertTrue(rows.next())
                assertEquals(
                    "{00000000-0000-4000-8000-000000000001,00000000-0000-4000-8000-000000000002}",
                    rows.getString(1),
                )
            }
        }
    }

    private fun createDatabase(postgres: PostgreSQLContainer<Nothing>, name: String): String {
        connection(postgres.jdbcUrl, postgres).use { connection ->
            connection.createStatement().use { it.execute("CREATE DATABASE $name") }
        }
        return postgres.jdbcUrl.substringBeforeLast('/') + "/$name"
    }

    private fun connection(url: String, postgres: PostgreSQLContainer<Nothing>): Connection =
        DriverManager.getConnection(url, postgres.username, postgres.password)

    private fun flyway(url: String, user: String, password: String, target: String = "latest"): Flyway =
        Flyway.configure()
            .dataSource(url, user, password)
            .locations("classpath:db/migration")
            .baselineVersion("1")
            .baselineDescription("verified db-service schema")
            .target(target)
            .load()

    private fun hasHistory(connection: Connection): Boolean =
        connection.prepareStatement("SELECT to_regclass('public.flyway_schema_history') IS NOT NULL").use { statement ->
            statement.executeQuery().use { rows -> rows.next() && rows.getBoolean(1) }
        }

    private companion object {
        const val EXPECTED_SCHEMA_FINGERPRINT = "b704ff11490fc5a432807ff2450d4a104d61b76e6d2b38da7411338edfae86d3"
        const val MIGRATION_COUNT = 3
    }
}
