package com.dsbuilder.settings.data

import com.dsbuilder.settings.domain.PersonalAccessToken
import kotlinx.coroutines.runBlocking
import org.flywaydb.core.Flyway
import org.flywaydb.core.api.exception.FlywayValidateException
import org.jetbrains.exposed.v1.jdbc.Database
import org.testcontainers.containers.PostgreSQLContainer
import java.nio.file.Files
import java.sql.DriverManager
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class PersonalAccessTokenMigrationTest {
    @Test fun `existing projects database migrates and old keys stay revoked after restart`(): Unit = runBlocking {
        val postgres = PostgreSQLContainer<Nothing>("postgres:16-alpine")
        postgres.start()
        try {
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                connection.createStatement().use { sql ->
                    sql.execute(
                        """CREATE TABLE project_access_keys (
                        id TEXT PRIMARY KEY, status TEXT NOT NULL,
                        revoked_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL)""",
                    )
                    sql.execute("INSERT INTO project_access_keys VALUES ('old', 'active', NULL, CURRENT_TIMESTAMP)")
                }
            }
            assertEquals(2, flyway(postgres).migrate().migrationsExecuted)
            assertEquals(0, flyway(postgres).migrate().migrationsExecuted)
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                connection.createStatement().use { sql ->
                    sql.executeQuery(
                        "SELECT status, revoked_at FROM project_access_keys WHERE id = 'old'",
                    ).use { rows ->
                        assertTrue(rows.next())
                        assertEquals("revoked", rows.getString(1))
                        assertNotNull(rows.getTimestamp(2))
                    }
                }
            }
            assertTokenRoundTrip(postgres)
        } finally { postgres.stop() }
    }

    @Test fun `fresh database migrates without recreating project keys and restarts safely`(): Unit = runBlocking {
        val postgres = PostgreSQLContainer<Nothing>("postgres:16-alpine")
        postgres.start()
        try {
            assertEquals(2, flyway(postgres).migrate().migrationsExecuted)
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                connection.createStatement().use { sql ->
                    sql.executeQuery("SELECT to_regclass('project_access_keys') IS NOT NULL").use { rows ->
                        assertTrue(rows.next())
                        assertFalse(rows.getBoolean(1))
                    }
                }
            }
            assertTokenRoundTrip(postgres)
            assertEquals(0, flyway(postgres).migrate().migrationsExecuted)
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                connection.createStatement().use { sql ->
                    sql.executeQuery("SELECT count(*) FROM personal_access_tokens WHERE id = 'pat'").use { rows ->
                        assertTrue(rows.next())
                        assertEquals(1, rows.getInt(1))
                    }
                }
            }
        } finally { postgres.stop() }
    }

    @Test fun `previous V2 checksum requires explicit repair without changing revocation`() {
        val postgres = PostgreSQLContainer<Nothing>("postgres:16-alpine")
        val oldMigration = Files.createTempDirectory("pat-previous-migration")
        val oldSql = oldMigration.resolve("V2__revoke_project_keys.sql")
        Files.writeString(
            oldSql,
            "UPDATE project_access_keys SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP, " +
                "updated_at = CURRENT_TIMESTAMP WHERE revoked_at IS NULL;\n",
        )
        postgres.start()
        try {
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                connection.createStatement().use { sql ->
                    sql.execute(
                        "CREATE TABLE project_access_keys " +
                            "(id TEXT PRIMARY KEY, status TEXT NOT NULL, " +
                            "revoked_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)",
                    )
                    sql.execute("INSERT INTO project_access_keys VALUES ('old', 'active', NULL, CURRENT_TIMESTAMP)")
                }
            }
            val previous = flyway(
                postgres,
                "classpath:dsbuilder/user-settings/migrations",
                "filesystem:$oldMigration",
            )
            assertEquals(2, previous.migrate().migrationsExecuted)
            val current = flyway(postgres)
            assertFailsWith<FlywayValidateException> { current.migrate() }
            current.repair()
            assertEquals(0, current.migrate().migrationsExecuted)
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                connection.createStatement().use { sql ->
                    sql.executeQuery(
                        "SELECT status, revoked_at FROM project_access_keys WHERE id = 'old'",
                    ).use { rows ->
                        assertTrue(rows.next())
                        assertEquals("revoked", rows.getString(1))
                        assertNotNull(rows.getTimestamp(2))
                    }
                }
            }
        } finally {
            postgres.stop()
            Files.deleteIfExists(oldSql)
            Files.deleteIfExists(oldMigration)
        }
    }

    private fun flyway(
        postgres: PostgreSQLContainer<Nothing>,
        vararg locations: String = arrayOf(
            "classpath:dsbuilder/user-settings/migrations",
            "classpath:dsbuilder/projects/pat-migrations",
        ),
    ): Flyway = Flyway.configure()
        .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
        .table("user_settings_schema_history").baselineOnMigrate(true).baselineVersion("0")
        .locations(*locations).load()

    private fun connect(postgres: PostgreSQLContainer<Nothing>): Database = Database.connect(
        postgres.jdbcUrl,
        "org.postgresql.Driver",
        postgres.username,
        postgres.password,
    )

    private suspend fun assertTokenRoundTrip(postgres: PostgreSQLContainer<Nothing>) {
        val database = connect(postgres)
        try {
            val repository = ExposedTokenRepository(database)
            val at = Instant.parse("2026-11-03T00:00:00Z")
            val token = PersonalAccessToken("pat", "u", "CI", setOf("projects:read"), "hash", at, at.plusSeconds(10))
            repository.create(token)
            assertEquals(token, repository.find("pat"))
        } finally {
            org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager.closeAndUnregister(database)
        }
    }
}
