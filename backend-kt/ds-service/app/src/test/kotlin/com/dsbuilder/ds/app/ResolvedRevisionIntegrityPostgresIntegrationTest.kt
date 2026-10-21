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

class ResolvedRevisionIntegrityPostgresIntegrationTest {
    @Test
    fun `legacy duplicate system names do not block unrelated names and are not rewritten`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            flyway(postgres, "7").migrate()
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                insertSystemRevision(connection, "Legacy duplicate")
                insertSystemRevision(connection, "Legacy duplicate")
                flyway(postgres).migrate()
                insertSystemRevision(connection, "Unrelated unique")
                assertEquals("3", scalar(connection, "SELECT count(*) FROM design_systems"))
                connection.autoCommit = false
                val failure = assertFailsWith<SQLException> {
                    insertSystemRevision(connection, "Legacy duplicate")
                    execute(connection, "SET CONSTRAINTS ALL IMMEDIATE")
                }
                assertEquals("23505", failure.sqlState)
                connection.rollback()
                assertEquals(
                    "2",
                    scalar(
                        connection,
                        "SELECT count(*) FROM design_system_revisions WHERE name = 'Legacy duplicate'",
                    ),
                )
            }
        }
    }

    @Test
    fun `palette write invalidates an earlier immediate graph check`() {
        IsolatedPostgresDatabase.create().use { database ->
            DriverManager.getConnection(database.jdbcUrl, database.username, database.password).use { connection ->
                val owner = insertSystemRevision(connection, "Palette immediate fixture")
                val draft = UUID.randomUUID()
                execute(
                    connection,
                    "INSERT INTO design_system_versions(id, design_system_id, status, " +
                        "sequence_number, revision, published_at) VALUES ('$draft', '$owner', 'draft', 1, 0, NULL)",
                )
                connection.autoCommit = false
                insertGroupRevision(connection, owner, draft, "first")
                execute(connection, "SET CONSTRAINTS ALL IMMEDIATE")
                val failure = assertFailsWith<SQLException> {
                    insertGroupRevision(connection, owner, draft, "second")
                }
                assertEquals("23505", failure.sqlState)
                connection.rollback()
                assertEquals("0", scalar(connection, "SELECT count(*) FROM token_groups"))
            }
        }
    }

    private fun insertGroupRevision(connection: Connection, owner: UUID, draft: UUID, code: String) {
        val group = UUID.randomUUID()
        execute(
            connection,
            """
            INSERT INTO token_groups(id, design_system_id, kind) VALUES ('$group', '$owner', 'color');
            INSERT INTO token_group_revisions(group_id, design_system_id, design_system_version_id,
                version_sequence_number, code, label, position)
                VALUES ('$group', '$owner', '$draft', 1, '$code', 'Same label', 0);
            """.trimIndent(),
        )
    }

    private fun insertSystemRevision(connection: Connection, name: String): UUID {
        val owner = UUID.randomUUID()
        val baseline = UUID.randomUUID()
        execute(
            connection,
            """
            INSERT INTO design_systems(id, project_name, project_id) VALUES ('$owner', 'fixture', 'project');
            INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, revision, published_at)
                VALUES ('$baseline', '$owner', 'baseline', 0, 0, NULL);
            INSERT INTO design_system_revisions(design_system_id, design_system_version_id, version_sequence_number, name)
                VALUES ('$owner', '$baseline', 0, '$name');
            """.trimIndent(),
        )
        return owner
    }

    @Test
    fun `resolved constraints protect inherited slots names and state owners after migration`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            flyway(postgres, "6").migrate()
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                seedDev(connection)
                flyway(postgres).migrate()
                val draft = scalar(connection, "SELECT id FROM design_system_versions WHERE status = 'draft'")
                connection.autoCommit = false
                assertRejected(
                    connection,
                    "23505",
                    """
                    INSERT INTO tenants(id, design_system_id) VALUES ('$NEW_TENANT', '$DS');
                    INSERT INTO tenant_revisions(tenant_id, design_system_id, design_system_version_id,
                        version_sequence_number, name, color_config)
                    VALUES ('$NEW_TENANT', '$DS', '$draft', 1, 'light', '{}'::jsonb);
                    """.trimIndent(),
                )
                assertRejected(
                    connection,
                    "23505",
                    """
                    INSERT INTO appearances(id, design_system_id, component_id) VALUES ('$NEW_APPEARANCE', '$DS', '$COMPONENT');
                    INSERT INTO appearance_revisions(appearance_id, design_system_id, design_system_version_id,
                        version_sequence_number, name)
                    VALUES ('$NEW_APPEARANCE', '$DS', '$draft', 1, NULL);
                    """.trimIndent(),
                )
                assertRejected(
                    connection,
                    "23505",
                    """
                    INSERT INTO tokens(id, design_system_id) VALUES ('$NEW_TOKEN', '$DS');
                    INSERT INTO token_revisions(token_id, design_system_id, design_system_version_id,
                        version_sequence_number, name, type, enabled)
                    VALUES ('$NEW_TOKEN', '$DS', '$draft', 1, 'text.original', 'color', true);
                    """.trimIndent(),
                )
                assertRejected(
                    connection,
                    "23505",
                    """
                    INSERT INTO invariant_property_values(id, design_system_id, component_id, property_id, appearance_id)
                    VALUES ('$NEW_VALUE', '$DS', '$COMPONENT', '$PROPERTY', '$APPEARANCE');
                    INSERT INTO invariant_property_value_revisions(invariant_property_value_id, design_system_id,
                        design_system_version_id, version_sequence_number, value, position, state_set_id)
                    VALUES ('$NEW_VALUE', '$DS', '$draft', 1, 'second', 0, '$EMPTY_SET');
                    """.trimIndent(),
                )
                assertRejected(
                    connection,
                    "23514",
                    """
                    INSERT INTO invariant_property_value_revisions(invariant_property_value_id, design_system_id,
                        design_system_version_id, version_sequence_number, value, position, state_set_id)
                    VALUES ('$VALUE', '$DS', '$draft', 1, 'foreign state', 0, '$FOREIGN_SET');
                    """.trimIndent(),
                )

                execute(
                    connection,
                    """
                    INSERT INTO token_revisions(token_id, design_system_id, design_system_version_id,
                        version_sequence_number, name, type, deleted)
                    VALUES ('$TOKEN', '$DS', '$draft', 1, 'text.original', 'color', true);
                    INSERT INTO tokens(id, design_system_id) VALUES ('$NEW_TOKEN', '$DS');
                    INSERT INTO token_revisions(token_id, design_system_id, design_system_version_id,
                        version_sequence_number, name, type, enabled)
                    VALUES ('$NEW_TOKEN', '$DS', '$draft', 1, 'text.original', 'color', true);
                    SET CONSTRAINTS ALL IMMEDIATE;
                    SET CONSTRAINTS ALL DEFERRED;
                    """.trimIndent(),
                )
                connection.commit()
                assertRejected(
                    connection,
                    "23505",
                    """
                    DELETE FROM token_revisions WHERE token_id = '$TOKEN' AND design_system_version_id = '$draft';
                    """.trimIndent(),
                )
                assertEquals(
                    "true",
                    scalar(
                        connection,
                        "SELECT deleted::text FROM token_revisions " +
                            "WHERE token_id = '$TOKEN' AND design_system_version_id = '$draft'",
                    ),
                )
                connection.rollback()
            }
        }
    }

    private fun assertRejected(connection: Connection, state: String, sql: String) {
        val failure = assertFailsWith<SQLException> {
            execute(connection, sql)
            execute(connection, "SET CONSTRAINTS ALL IMMEDIATE")
        }
        assertEquals(state, failure.sqlState)
        connection.rollback()
    }

    private fun seedDev(connection: Connection) = execute(
        connection,
        """
        INSERT INTO design_systems(id, name, project_name) VALUES ('$DS', 'Integrity fixture', 'fixture');
        INSERT INTO tokens(id, design_system_id, name, type) VALUES ('$TOKEN', '$DS', 'text.original', 'color');
        INSERT INTO tenants(id, design_system_id, name) VALUES ('$TENANT', '$DS', 'Light');
        INSERT INTO components(id, name, platform) VALUES
            ('$COMPONENT', 'IntegrityA', 'web'), ('$FOREIGN_COMPONENT', 'IntegrityB', 'web');
        INSERT INTO properties(id, component_id, name, type) VALUES ('$PROPERTY', '$COMPONENT', 'color', 'color');
        INSERT INTO appearances(id, design_system_id, component_id, name) VALUES ('$APPEARANCE', '$DS', '$COMPONENT', NULL);
        INSERT INTO states(id, component_id, name) VALUES ('$FOREIGN_STATE', '$FOREIGN_COMPONENT', 'checked');
        INSERT INTO state_sets(id, state_ids) VALUES ('$FOREIGN_SET', ARRAY['$FOREIGN_STATE']::uuid[]);
        INSERT INTO invariant_property_values(id, design_system_id, component_id, property_id, appearance_id,
            value, state_set_id) VALUES ('$VALUE', '$DS', '$COMPONENT', '$PROPERTY', '$APPEARANCE', 'original', '$EMPTY_SET');
        """.trimIndent(),
    )

    private fun flyway(postgres: PostgreSQLContainer<Nothing>, target: String = "latest") = Flyway.configure()
        .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
        .locations("classpath:db/migration").target(target).load()

    private fun execute(connection: Connection, sql: String) {
        connection.createStatement().use { it.execute(sql) }
    }

    private fun scalar(connection: Connection, sql: String): String = connection.createStatement().use { statement ->
        statement.executeQuery(sql).use { rows ->
            check(rows.next())
            rows.getString(1)
        }
    }

    private companion object {
        val DS = UUID.randomUUID()
        val TOKEN = UUID.randomUUID()
        val NEW_TOKEN = UUID.randomUUID()
        val COMPONENT = UUID.randomUUID()
        val FOREIGN_COMPONENT = UUID.randomUUID()
        val PROPERTY = UUID.randomUUID()
        val APPEARANCE = UUID.randomUUID()
        const val EMPTY_SET = "00000000-0000-4000-8000-0000000000ff"
        val FOREIGN_SET = UUID.randomUUID()
        val FOREIGN_STATE = UUID.randomUUID()
        val VALUE = UUID.randomUUID()
        val NEW_VALUE = UUID.randomUUID()
        val TENANT = UUID.randomUUID()
        val NEW_TENANT = UUID.randomUUID()
        val NEW_APPEARANCE = UUID.randomUUID()
    }
}
