package com.dsbuilder.settings.data

import com.dsbuilder.settings.domain.PersonalAccessToken
import kotlinx.coroutines.runBlocking
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.v1.jdbc.Database
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.DriverManager
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

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
            fun migrate() = Flyway.configure()
                .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
                .table("user_settings_schema_history").baselineOnMigrate(true).baselineVersion("0")
                .locations(
                    "classpath:dsbuilder/user-settings/migrations",
                    "classpath:dsbuilder/projects/pat-migrations",
                )
                .load().migrate()
            assertEquals(2, migrate().migrationsExecuted)
            assertEquals(0, migrate().migrationsExecuted)
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
            val database = Database.connect(
                postgres.jdbcUrl,
                "org.postgresql.Driver",
                postgres.username,
                postgres.password,
            )
            try {
                val repository = ExposedTokenRepository(database)
                val at = Instant.parse("2026-11-03T00:00:00Z")
                val token =
                    PersonalAccessToken("pat", "u", "CI", setOf("projects:read"), "hash", at, at.plusSeconds(10))
                repository.create(token)
                assertEquals(token, repository.find("pat"))
            } finally {
                org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager.closeAndUnregister(database)
            }
        } finally { postgres.stop() }
    }
}
