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

/** V14 размножает общие оси по дизайн-системам, переносит ссылки и ревизии и защищает системы друг от друга. */
class VariationAxesMigrationPostgresIntegrationTest {
    @Test
    fun `shared axes are split per design system with their references and revisions`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            flyway(postgres, "13").migrate()
            val fixture = connection(postgres).use(::seed)
            flyway(postgres, null).migrate()

            connection(postgres).use { connection ->
                val sizeA = fixture.sizeOf(connection, fixture.systemA)
                val sizeB = fixture.sizeOf(connection, fixture.systemB)
                assertEquals(fixture.size, sizeA, "the first design system keeps the original axis")
                assertEquals(false, sizeA == sizeB)

                assertEquals("3", variationCount(connection, fixture.button))
                val sizeC = fixture.sizeOf(connection, fixture.systemC)
                assertEquals(
                    "size",
                    scalar(connection, "SELECT name FROM variation_revisions WHERE variation_id = '$sizeC'"),
                )
                assertEquals("0", variationCount(connection, fixture.orphanComponent), "an axis nobody uses is removed")
                listOf(fixture.systemA to sizeA, fixture.systemB to sizeB).forEach { (system, own) ->
                    assertEquals(
                        own.toString(),
                        scalar(connection, "SELECT variation_id FROM styles WHERE design_system_id = '$system'"),
                    )
                    assertEquals(
                        own.toString(),
                        scalar(
                            connection,
                            "SELECT variation_id FROM appearance_variations WHERE design_system_id = '$system'",
                        ),
                    )
                    assertEquals(
                        own.toString(),
                        scalar(
                            connection,
                            "SELECT root_variation_id FROM appearance_revisions WHERE design_system_id = '$system'",
                        ),
                    )
                    assertEquals(
                        system.toString(),
                        scalar(
                            connection,
                            "SELECT design_system_id FROM property_variations WHERE variation_id = '$own'",
                        ),
                    )
                    assertEquals(
                        "size",
                        scalar(connection, "SELECT name FROM variation_revisions WHERE variation_id = '$own'"),
                    )
                }
                assertEquals("3", scalar(connection, "SELECT count(*) FROM property_variations"))
            }
        }
    }

    @Test
    fun `an axis name is unique per design system and component and foreign references are rejected`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            flyway(postgres, "13").migrate()
            val fixture = connection(postgres).use(::seed)
            flyway(postgres, null).migrate()

            connection(postgres).use { connection ->
                val sizeA = fixture.sizeOf(connection, fixture.systemA)
                val sizeB = fixture.sizeOf(connection, fixture.systemB)
                val draftA = scalar(
                    connection,
                    "SELECT id FROM design_system_versions " +
                        "WHERE design_system_id = '${fixture.systemA}' AND status = 'draft'",
                )
                val duplicate = UUID.randomUUID()
                connection.autoCommit = false
                val nameFailure = assertFailsWith<SQLException> {
                    update(
                        connection,
                        "INSERT INTO variations(id, design_system_id, component_id) " +
                            "VALUES ('$duplicate', '${fixture.systemA}', '${fixture.button}')",
                    )
                    update(
                        connection,
                        "INSERT INTO variation_revisions(variation_id, design_system_id, design_system_version_id, " +
                            "version_sequence_number, name) " +
                            "VALUES ('$duplicate', '${fixture.systemA}', '$draftA', 1, 'size')",
                    )
                    update(connection, "SET CONSTRAINTS ALL IMMEDIATE")
                }
                assertEquals("23505", nameFailure.sqlState)
                connection.rollback()

                val foreign = assertFailsWith<SQLException> {
                    update(
                        connection,
                        "INSERT INTO styles(design_system_id, variation_id) VALUES ('${fixture.systemA}', '$sizeB')",
                    )
                    update(connection, "SET CONSTRAINTS ALL IMMEDIATE")
                }
                assertEquals("23503", foreign.sqlState)
                connection.rollback()
                assertEquals(false, sizeA == sizeB)
            }
        }
    }

    private fun seed(connection: Connection): Fixture {
        val fixture = Fixture()
        listOf(
            fixture.systemA to "2026-01-01",
            fixture.systemB to "2026-01-02",
            fixture.systemC to "2026-01-03",
        ).forEach { (system, created) ->
            update(
                connection,
                "INSERT INTO design_systems(id, project_name, created_at) VALUES ('$system', 'p', '$created')",
            )
            update(
                connection,
                "INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, revision, " +
                    "published_at) VALUES ('${UUID.randomUUID()}', '$system', 'baseline', 0, 0, NULL)",
            )
        }
        insertComponent(connection, fixture.button, "Button")
        insertComponent(connection, fixture.orphanComponent, "Orphan")
        update(
            connection,
            "INSERT INTO properties(id, component_id, name, type) " +
                "VALUES ('${fixture.property}', '${fixture.button}', 'gap', 'value')",
        )
        insertVariation(connection, fixture.size, fixture.button, "size")
        insertVariation(connection, fixture.orphan, fixture.orphanComponent, "unused")
        update(
            connection,
            "INSERT INTO property_variations(property_id, variation_id) " +
                "VALUES ('${fixture.property}', '${fixture.size}')",
        )
        // Система C только подключила компонент: ось без использования всё равно копируется для неё.
        update(
            connection,
            "INSERT INTO design_system_components(design_system_id, component_id) " +
                "VALUES ('${fixture.systemC}', '${fixture.button}')",
        )
        update(
            connection,
            "INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, revision, " +
                "published_at) VALUES ('${UUID.randomUUID()}', '${fixture.systemC}', 'draft', 1, 0, NULL)",
        )
        listOf(fixture.systemA, fixture.systemB).forEach { system ->
            val appearance = UUID.randomUUID()
            val style = UUID.randomUUID()
            update(
                connection,
                "INSERT INTO design_system_components(design_system_id, component_id) " +
                    "VALUES ('$system', '${fixture.button}')",
            )
            update(
                connection,
                "INSERT INTO appearances(id, design_system_id, component_id) " +
                    "VALUES ('$appearance', '$system', '${fixture.button}')",
            )
            update(
                connection,
                "INSERT INTO styles(id, design_system_id, variation_id) " +
                    "VALUES ('$style', '$system', '${fixture.size}')",
            )
            update(
                connection,
                "INSERT INTO style_revisions(style_id, design_system_id, design_system_version_id, " +
                    "version_sequence_number, name) " +
                    "SELECT '$style', '$system', id, sequence_number, 'm' FROM design_system_versions " +
                    "WHERE design_system_id = '$system' AND status = 'baseline'",
            )
            update(
                connection,
                "INSERT INTO appearance_variations(appearance_id, variation_id, design_system_id) " +
                    "VALUES ('$appearance', '${fixture.size}', '$system')",
            )
            update(
                connection,
                "INSERT INTO appearance_revisions(appearance_id, design_system_id, design_system_version_id, " +
                    "version_sequence_number, name, root_variation_id) " +
                    "SELECT '$appearance', '$system', id, sequence_number, 'default', '${fixture.size}' " +
                    "FROM design_system_versions WHERE design_system_id = '$system' AND status = 'baseline'",
            )
            update(
                connection,
                "INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, revision, " +
                    "published_at) VALUES ('${UUID.randomUUID()}', '$system', 'draft', 1, 0, NULL)",
            )
        }
        return fixture
    }

    private fun insertComponent(connection: Connection, id: UUID, name: String) = update(
        connection,
        "INSERT INTO components(id, name, platform) VALUES ('$id', '$name', 'web')",
    )

    private fun insertVariation(connection: Connection, id: UUID, component: UUID, name: String) = update(
        connection,
        "INSERT INTO variations(id, component_id, name) VALUES ('$id', '$component', '$name')",
    )

    private fun variationCount(connection: Connection, component: UUID) =
        scalar(connection, "SELECT count(*) FROM variations WHERE component_id = '$component'")

    private fun scalar(connection: Connection, sql: String): String = connection.createStatement().use { statement ->
        statement.executeQuery(sql).use { rows ->
            rows.next()
            rows.getString(1)
        }
    }

    private fun update(connection: Connection, sql: String) {
        connection.createStatement().use { it.execute(sql) }
    }

    private fun connection(postgres: PostgreSQLContainer<Nothing>): Connection =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password)

    private fun flyway(postgres: PostgreSQLContainer<Nothing>, target: String?): Flyway = Flyway.configure()
        .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
        .locations("classpath:dsbuilder/ds/db/migration")
        .also { configuration -> target?.let(configuration::target) }
        .load()

    private class Fixture {
        val systemA: UUID = UUID.randomUUID()
        val systemB: UUID = UUID.randomUUID()
        val systemC: UUID = UUID.randomUUID()
        val button: UUID = UUID.randomUUID()
        val orphanComponent: UUID = UUID.randomUUID()
        val property: UUID = UUID.randomUUID()
        val size: UUID = UUID.randomUUID()
        val orphan: UUID = UUID.randomUUID()

        fun sizeOf(connection: Connection, system: UUID): UUID = connection.createStatement().use { statement ->
            statement.executeQuery(
                "SELECT v.id FROM variations v JOIN variation_revisions r ON r.variation_id = v.id " +
                    "WHERE v.design_system_id = '$system' AND r.name = 'size'",
            ).use { rows ->
                rows.next()
                rows.getObject(1) as UUID
            }
        }
    }
}
