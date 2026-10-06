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

            assertEquals(2, flyway.migrate().migrationsExecuted)
            assertEquals(0, flyway.migrate().migrationsExecuted)
            assertTrue(flyway.validateWithResult().validationSuccessful)
            val expected = connection(cleanUrl, postgres).use(SchemaFingerprintCalculator()::calculate)
            assertEquals(EXPECTED_SCHEMA_FINGERPRINT, expected)
            connection(cleanUrl, postgres).use(::assertComponentImportGuards)
            assertFailureRollsBack(cleanUrl, postgres)

            val matchingUrl = createDatabase(postgres, "matching_legacy")
            connection(matchingUrl, postgres).use(::applyBaselineWithoutHistory)
            connection(matchingUrl, postgres).use { connection ->
                ExistingDatabaseAdopter(SchemaFingerprintCalculator()).adopt(
                    connection,
                    flyway(matchingUrl, postgres.username, postgres.password),
                    expected,
                )
            }
            connection(matchingUrl, postgres).use { assertTrue(hasHistory(it)) }

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

    private fun flyway(url: String, user: String, password: String): Flyway = Flyway.configure()
        .dataSource(url, user, password)
        .locations("classpath:db/migration")
        .baselineVersion("1")
        .baselineDescription("verified db-service schema")
        .load()

    private fun hasHistory(connection: Connection): Boolean =
        connection.prepareStatement("SELECT to_regclass('public.flyway_schema_history') IS NOT NULL").use { statement ->
            statement.executeQuery().use { rows -> rows.next() && rows.getBoolean(1) }
        }

    private companion object {
        const val EXPECTED_SCHEMA_FINGERPRINT = "7008e23cefc457c02ba1148b1aee60c9ee75f841c3393f90bc6871a6bbd38108"
    }
}
