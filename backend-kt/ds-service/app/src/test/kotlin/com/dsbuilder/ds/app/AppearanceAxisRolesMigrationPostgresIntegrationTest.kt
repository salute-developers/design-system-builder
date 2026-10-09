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

class AppearanceAxisRolesMigrationPostgresIntegrationTest {
    @Test
    fun `roles are migrated from flags by the fallback order and references hold`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            flyway(postgres, "2").migrate()
            val fixture = connection(postgres).use(::seed)
            flyway(postgres, null).migrate()

            connection(postgres).use { connection ->
                assertRoles(connection, fixture.sizeAndScheme, root = fixture.size, scheme = fixture.view)
                assertRoles(connection, fixture.noSizeNoFlag, root = fixture.shape, scheme = null)
                assertRoles(connection, fixture.twoFlags, root = fixture.size, scheme = fixture.view)
                assertRoles(connection, fixture.noAxes, root = null, scheme = null)
                assertRoles(connection, fixture.onlyScheme, root = null, scheme = fixture.view)
                assertEquals(listOf(true, false), flags(connection, fixture.twoFlags, fixture.view, fixture.state))

                assertFailsWith<SQLException> {
                    update(
                        connection,
                        "UPDATE appearances SET root_variation_id = '${fixture.size}' " +
                            "WHERE id = '${fixture.noSizeNoFlag}'",
                    )
                }
                update(
                    connection,
                    "DELETE FROM appearance_variations WHERE appearance_id = '${fixture.sizeAndScheme}' " +
                        "AND variation_id = '${fixture.size}'",
                )
                assertRoles(connection, fixture.sizeAndScheme, root = null, scheme = fixture.view)
                update(connection, "DELETE FROM appearance_variations WHERE appearance_id = '${fixture.sizeAndScheme}'")
                assertRoles(connection, fixture.sizeAndScheme, root = null, scheme = null)
            }
        }
    }

    private fun seed(connection: Connection): Fixture {
        val fixture = Fixture()
        update(connection, "INSERT INTO design_systems(id, name, project_name) VALUES ('${fixture.ds}', 'ds', 'p')")
        update(
            connection,
            "INSERT INTO components(id, name) VALUES ('${fixture.component}', 'Button')",
        )
        listOf(fixture.size to "size", fixture.shape to "shape", fixture.view to "view", fixture.state to "state")
            .forEach { (id, name) ->
                update(
                    connection,
                    "INSERT INTO variations(id, component_id, name) VALUES ('$id', '${fixture.component}', '$name')",
                )
            }
        axes(
            connection,
            fixture.sizeAndScheme,
            "a",
            listOf(fixture.shape to false, fixture.size to false, fixture.view to true),
        )
        axes(connection, fixture.noSizeNoFlag, "b", listOf(fixture.shape to false, fixture.state to false))
        axes(
            connection,
            fixture.twoFlags,
            "c",
            listOf(fixture.size to false, fixture.view to true, fixture.state to true),
        )
        axes(connection, fixture.noAxes, "d", emptyList())
        axes(connection, fixture.onlyScheme, "e", listOf(fixture.view to true))
        return fixture
    }

    private fun axes(connection: Connection, appearance: UUID, name: String, axes: List<Pair<UUID, Boolean>>) {
        val fixtureDs = connection.prepareStatement("SELECT id FROM design_systems").use { statement ->
            statement.executeQuery().use { rows ->
                rows.next()
                rows.getString(1)
            }
        }
        val component = connection.prepareStatement("SELECT id FROM components").use { statement ->
            statement.executeQuery().use { rows ->
                rows.next()
                rows.getString(1)
            }
        }
        update(
            connection,
            "INSERT INTO appearances(id, design_system_id, component_id, name, platform) " +
                "VALUES ('$appearance', '$fixtureDs', '$component', '$name', 'web')",
        )
        axes.forEachIndexed { position, (variation, scheme) ->
            update(
                connection,
                "INSERT INTO appearance_variations(appearance_id, variation_id, position, is_color_scheme) " +
                    "VALUES ('$appearance', '$variation', $position, $scheme)",
            )
        }
    }

    private fun assertRoles(connection: Connection, appearance: UUID, root: UUID?, scheme: UUID?) {
        connection.prepareStatement(
            "SELECT root_variation_id, color_scheme_variation_id FROM appearances WHERE id = ?",
        ).use { statement ->
            statement.setObject(1, appearance)
            statement.executeQuery().use { rows ->
                assertTrue(rows.next())
                assertEquals(root, rows.getObject(1) as UUID?)
                assertEquals(scheme, rows.getObject(2) as UUID?)
            }
        }
    }

    private fun flags(connection: Connection, appearance: UUID, vararg variations: UUID): List<Boolean> =
        variations.map { variation ->
            connection.prepareStatement(
                "SELECT is_color_scheme FROM appearance_variations WHERE appearance_id = ? AND variation_id = ?",
            ).use { statement ->
                statement.setObject(1, appearance)
                statement.setObject(2, variation)
                statement.executeQuery().use { rows ->
                    assertTrue(rows.next())
                    rows.getBoolean(1)
                }
            }
        }

    private fun update(connection: Connection, sql: String) {
        connection.createStatement().use { it.execute(sql) }
    }

    private fun connection(postgres: PostgreSQLContainer<Nothing>): Connection =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password)

    private fun flyway(postgres: PostgreSQLContainer<Nothing>, target: String?): Flyway = Flyway.configure()
        .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
        .locations("classpath:db/migration")
        .also { configuration -> target?.let(configuration::target) }
        .load()

    private class Fixture {
        val ds: UUID = UUID.randomUUID()
        val component: UUID = UUID.randomUUID()
        val size: UUID = UUID.randomUUID()
        val shape: UUID = UUID.randomUUID()
        val view: UUID = UUID.randomUUID()
        val state: UUID = UUID.randomUUID()
        val sizeAndScheme: UUID = UUID.randomUUID()
        val noSizeNoFlag: UUID = UUID.randomUUID()
        val twoFlags: UUID = UUID.randomUUID()
        val noAxes: UUID = UUID.randomUUID()
        val onlyScheme: UUID = UUID.randomUUID()
    }
}
