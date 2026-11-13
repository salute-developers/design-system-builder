@file:Suppress("ktlint:standard:max-line-length")

package com.dsbuilder.ds.app

import org.flywaydb.core.Flyway
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.Connection
import java.sql.DriverManager
import java.sql.SQLException
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/** Обновляет реальную схему до Core-релизов и проверяет происхождение старых границ. */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class CoreReleaseMigrationPostgresIntegrationTest {
    @Test
    fun `migration pins an explicitly unknown technical snapshot and protects stable import identities`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            val config = Flyway.configure().dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
                .locations("classpath:dsbuilder/ds/db/migration")
            config.target("18").load().migrate()
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                val ds = UUID.randomUUID()
                val published = UUID.randomUUID()
                val draft = UUID.randomUUID()
                val component = UUID.randomUUID()
                val property = UUID.randomUUID()
                connection.createStatement().use { statement ->
                    statement.execute(
                        "INSERT INTO components(id, name, platform) VALUES ('$component', 'OldButton', 'compose')",
                    )
                    statement.execute(
                        "INSERT INTO properties(id, component_id, name, type) VALUES ('$property', '$component', 'fill', 'color')",
                    )
                    statement.execute(
                        "INSERT INTO design_systems(id, project_name, project_id) VALUES ('$ds', 'migration', 'project')",
                    )
                    statement.execute(
                        "INSERT INTO design_system_versions(design_system_id, status, sequence_number, revision, published_at) VALUES ('$ds', 'baseline', 0, 0, NULL)",
                    )
                    statement.execute(
                        "INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, revision, version, published_at) VALUES ('$published', '$ds', 'draft', 1, 0, NULL, NULL)",
                    )
                }
                connection.createStatement().use { statement ->
                    statement.execute(
                        "UPDATE design_system_versions SET status = 'published', version = '1.0.0', published_at = now() WHERE id = '$published'",
                    )
                    statement.execute(
                        "INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, revision, published_at) VALUES ('$draft', '$ds', 'draft', 2, 0, NULL)",
                    )
                }
                assertEquals(2, config.target("latest").load().migrate().migrationsExecuted)
                val release =
                    scalar(
                        connection,
                        "SELECT release_id FROM design_system_version_core_releases WHERE version_id = '$published' AND platform = 'compose'",
                    )
                assertEquals(
                    "migration-snapshot",
                    scalar(connection, "SELECT provenance FROM core_releases WHERE id = '$release'"),
                )
                assertEquals(
                    "unknown",
                    scalar(
                        connection,
                        "SELECT normalized_meta->>'historicalOrigin' FROM core_releases WHERE id = '$release'",
                    ),
                )
                assertEquals(
                    "t",
                    scalar(
                        connection,
                        "SELECT source_meta IS NULL AND meta_sha256 IS NULL FROM core_releases WHERE id = '$release'",
                    ),
                )
                assertEquals(
                    property.toString(),
                    scalar(connection, "SELECT property_id FROM core_release_properties WHERE release_id = '$release'"),
                )
                assertEquals(
                    "0",
                    scalar(
                        connection,
                        "SELECT count(*) FROM design_system_version_core_releases WHERE version_id = '$draft'",
                    ),
                )
                assertEquals(
                    "0",
                    scalar(
                        connection,
                        "SELECT count(*) FROM design_system_version_preview_builds WHERE build_id IS NOT NULL",
                    ),
                )

                for (sql in listOf(
                    "UPDATE components SET name = 'Renamed' WHERE id = '$component'",
                    "UPDATE properties SET name = 'renamed' WHERE id = '$property'",
                    "UPDATE core_release_properties SET type = 'integer' WHERE release_id = '$release'",
                    "DELETE FROM core_releases WHERE id = '$release'",
                )) {
                    val error = assertFailsWith<SQLException> { connection.createStatement().use { it.execute(sql) } }
                    assertEquals("23514", error.sqlState)
                    assertTrue(error.message.orEmpty().contains("IMMUTABLE"))
                }
                val future = UUID.randomUUID()
                connection.createStatement().use { statement ->
                    statement.execute(
                        "INSERT INTO core_releases(id, library_id, platform, version, source_meta, meta_sha256, normalized_meta, provenance) VALUES ('$future', 'uikit-compose', 'compose', 'future', convert_to('[]', 'UTF8'), repeat('a', 64), '[]', 'imported')",
                    )
                    statement.execute(
                        "UPDATE core_current_releases SET release_id = '$future' WHERE platform = 'compose'",
                    )
                }
                assertEquals(
                    release,
                    scalar(
                        connection,
                        "SELECT release_id FROM design_system_version_core_releases WHERE version_id = '$published' AND platform = 'compose'",
                    ),
                )
                assertEquals(
                    "color",
                    scalar(
                        connection,
                        "SELECT type FROM core_release_properties WHERE release_id = '$release' AND property_id = '$property'",
                    ),
                )
            }
        }
    }

    private fun scalar(connection: Connection, sql: String): String = connection.createStatement().use { statement ->
        statement.executeQuery(sql).use { rows ->
            check(rows.next())
            rows.getString(1)
        }
    }
}
