package com.dsbuilder.ds.app

import com.dsbuilder.ds.core.data.ExposedTransactionRunner
import com.dsbuilder.ds.core.data.PostgresTransactionFailureMapper
import com.dsbuilder.ds.designsystems.data.ExposedDesignSystemCatalogCounts
import kotlinx.coroutines.runBlocking
import org.jetbrains.exposed.v1.jdbc.Database
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class DesignSystemCatalogCountsPostgresIntegrationTest {
    @Test
    fun `counts active nontechnical systems in owned database including empty projects`() = runBlocking<Unit> {
        IsolatedPostgresDatabase.create().use { postgres ->
            val database = Database.connect(
                postgres.jdbcUrl,
                driver = "org.postgresql.Driver",
                user = postgres.username,
                password = postgres.password,
            )
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                listOf(
                    "p" to false,
                    "p" to false,
                    "p" to true,
                    "other" to false,
                    null to false,
                ).forEachIndexed { index, (project, deleted) ->
                    val id = UUID.randomUUID()
                    val baseline = UUID.randomUUID()
                    val draft = UUID.randomUUID()
                    connection.createStatement().use { statement ->
                        statement.execute(
                            "INSERT INTO design_systems(id, project_name, project_id) " +
                                "VALUES ('$id', 'fixture-$index', ${project?.let { "'$it'" } ?: "NULL"})",
                        )
                        statement.execute(
                            """
    INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, revision,
    published_at) VALUES ('$baseline', '$id', 'baseline', 0, 0, NULL)
                            """.trimIndent(),
                        )
                        statement.execute(
                            """
    INSERT INTO design_system_revisions(design_system_id, design_system_version_id,
    version_sequence_number, name, deleted) VALUES ('$id', '$baseline', 0, 'Fixture-$index', false)
                            """.trimIndent(),
                        )
                        statement.execute(
                            """
    INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, revision,
    published_at) VALUES ('$draft', '$id', 'draft', 1, 0, NULL)
                            """.trimIndent(),
                        )
                        statement.execute(
                            """
    INSERT INTO design_system_revisions(design_system_id, design_system_version_id,
    version_sequence_number, name, deleted) VALUES ('$id', '$draft', 1, 'Fixture-$index', $deleted)
                            """.trimIndent(),
                        )
                    }
                }
            }
            val counts =
                ExposedDesignSystemCatalogCounts(ExposedTransactionRunner(database, PostgresTransactionFailureMapper()))
            assertEquals(
                mapOf("p" to 2, "empty" to 0, "quote'project" to 0),
                counts.count(listOf("p", "empty", "quote'project")),
            )
            assertEquals(emptyMap(), counts.count(emptyList()))
            assertFailsWith<IllegalArgumentException> { counts.count(List(501) { "p$it" }) }
        }
    }
}
