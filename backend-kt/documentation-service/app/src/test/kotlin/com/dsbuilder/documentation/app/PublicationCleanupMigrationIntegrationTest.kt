package com.dsbuilder.documentation.app

import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals

class PublicationCleanupMigrationIntegrationTest {
    private val url = System.getenv(TEST_DATABASE_URL)?.also(::requireDedicatedTestDatabase)
    private val user = System.getenv(TEST_DATABASE_USER) ?: "documentation"
    private val password = System.getenv(TEST_DATABASE_PASSWORD) ?: "documentation"
    private val migration by lazy {
        requireNotNull(javaClass.getResource("/db/migration/V2__publication_cleanup_lifecycle.sql")).readText()
    }

    @Test
    fun `migration backfill is idempotent and cleanup job cascades`() {
        if (url == null) return
        val schema = "cleanup_migration_${UUID.randomUUID().toString().replace("-", "")}"
        connection().use { connection ->
            connection.createStatement().use { statement ->
                statement.execute("CREATE SCHEMA $schema")
                try {
                    statement.execute("SET search_path TO $schema")
                    statement.execute("CREATE TABLE documentation_bundles (id VARCHAR(80) PRIMARY KEY)")
                    statement.execute(
                        """
                            CREATE TABLE documentation_publications (
                                id VARCHAR(80) PRIMARY KEY,
                                status VARCHAR(32) NOT NULL
                            )
                        """.trimIndent(),
                    )
                    statement.execute(
                        """
                            INSERT INTO documentation_publications (id, status)
                            VALUES ('superseded-1', 'superseded'), ('published-1', 'published')
                        """.trimIndent(),
                    )

                    statement.execute(migration)
                    statement.execute(migration)

                    assertEquals(1, scalar(statement, "SELECT count(*) FROM publication_cleanup_jobs"))
                    assertEquals(
                        86_400,
                        scalar(
                            statement,
                            "SELECT EXTRACT(EPOCH FROM eligible_at - created_at)::bigint FROM publication_cleanup_jobs",
                        ),
                    )
                    statement.execute("DELETE FROM documentation_publications WHERE id = 'superseded-1'")
                    assertEquals(0, scalar(statement, "SELECT count(*) FROM publication_cleanup_jobs"))
                } finally {
                    statement.execute("DROP SCHEMA $schema CASCADE")
                }
            }
        }
    }

    private fun scalar(statement: java.sql.Statement, query: String): Long =
        statement.executeQuery(query).use { result ->
            result.next()
            result.getLong(1)
        }

    private fun connection() = DriverManager.getConnection(url, user, password)

    private companion object {
        const val TEST_DATABASE_URL = "DOCUMENTATION_TEST_DATABASE_URL"
        const val TEST_DATABASE_USER = "DOCUMENTATION_TEST_DATABASE_USER"
        const val TEST_DATABASE_PASSWORD = "DOCUMENTATION_TEST_DATABASE_PASSWORD"
    }
}

private fun requireDedicatedTestDatabase(url: String) {
    val databaseName = url.substringAfterLast('/').substringBefore('?')
    require(databaseName.endsWith("_test")) {
        "DOCUMENTATION_TEST_DATABASE_URL must reference a dedicated database whose name ends with _test"
    }
}
