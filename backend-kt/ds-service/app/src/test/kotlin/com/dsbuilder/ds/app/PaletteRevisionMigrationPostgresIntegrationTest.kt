package com.dsbuilder.ds.app

import org.flywaydb.core.Flyway
import org.flywaydb.core.api.FlywayException
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.Connection
import java.sql.DriverManager
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class PaletteRevisionMigrationPostgresIntegrationTest {
    @Test
    fun `upgrade dev preserves palette identities values groups and immutable template`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            val dev = flyway(postgres, "6")
            assertEquals(6, dev.migrate().migrationsExecuted)
            connection(postgres).use { connection ->
                seedDev(connection)
                assertEquals(6, flyway(postgres).migrate().migrationsExecuted)
                assertEquals(0, flyway(postgres).migrate().migrationsExecuted)
                assertEquals("12", scalar(connection, "SELECT count(*) FROM flyway_schema_history WHERE success"))
                assertEquals(
                    "custom",
                    scalar(connection, "SELECT label FROM tenant_palette_group_revisions WHERE group_id = '$GROUP'"),
                )
                assertEquals(RAMP, scalar(connection, "SELECT id FROM tenant_palette_ramps"))
                assertEquals("#123456", scalar(connection, "SELECT value FROM tenant_palette_step_revisions"))
                assertEquals("500", scalar(connection, "SELECT step FROM tenant_palette_steps"))
                assertEquals(GROUP, scalar(connection, "SELECT group_id FROM tenant_palette_token_group_revisions"))
                assertEquals(
                    TOKEN_GROUP,
                    scalar(connection, "SELECT group_id FROM token_revisions WHERE token_id = '$TOKEN'"),
                )
                assertEquals("7", scalar(connection, "SELECT position FROM token_revisions WHERE token_id = '$TOKEN'"))
                assertEquals("Original", scalar(connection, "SELECT label FROM token_group_revisions"))
                assertEquals("#112233", scalar(connection, "SELECT value FROM tenant_palette_template"))
                assertEquals("0", scalar(connection, "SELECT count(*) FROM entity_edit_states"))
                assertEquals(
                    "0",
                    scalar(
                        connection,
                        """
                        SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND (
                            (table_name = 'tenant_palette_groups' AND column_name IN ('label', 'position')) OR
                            (table_name = 'tenant_palette_steps' AND column_name = 'value') OR
                            (table_name = 'tokens' AND column_name IN ('group_id', 'position')))
                        """.trimIndent(),
                    ),
                )
                connection.createStatement().use { it.execute("UPDATE palette SET value = '#FFFFFF'") }
                assertEquals("#112233", scalar(connection, "SELECT value FROM tenant_palette_template"))
            }
        }
    }

    @Test
    fun `failed palette conversion rolls back schema and data and can be retried`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            flyway(postgres, "6").migrate()
            connection(postgres).use { connection ->
                seedDev(connection)
                connection.createStatement().use {
                    it.execute(
                        """
                        CREATE FUNCTION enforce_palette_revision_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
                        BEGIN RETURN NEW; END; $$;
                        """.trimIndent(),
                    )
                }
                val before = SchemaFingerprintCalculator().calculate(connection)
                assertFailsWith<FlywayException> { flyway(postgres).migrate() }
                assertEquals(before, SchemaFingerprintCalculator().calculate(connection))
                assertEquals(
                    "custom",
                    scalar(connection, "SELECT label FROM tenant_palette_groups WHERE id = '$GROUP'"),
                )
                assertEquals("#123456", scalar(connection, "SELECT value FROM tenant_palette_steps"))
                assertEquals("6", scalar(connection, "SELECT count(*) FROM flyway_schema_history WHERE success"))
                connection.createStatement().use { it.execute("DROP FUNCTION enforce_palette_revision_integrity()") }
                assertEquals(6, flyway(postgres).migrate().migrationsExecuted)
                assertEquals("#123456", scalar(connection, "SELECT value FROM tenant_palette_step_revisions"))
            }
        }
    }

    private fun seedDev(connection: Connection) {
        connection.createStatement().use { statement ->
            statement.execute(
                """
                INSERT INTO design_systems (id, name, project_name) VALUES ('$DS', 'Fixture', 'fixture');
                INSERT INTO tenants (id, design_system_id, name) VALUES ('$TENANT', '$DS', 'default');
                INSERT INTO palette (type, shade, saturation, value) VALUES ('general', 'red', 500, '#112233');
                INSERT INTO tenant_palette_template VALUES ('$TENANT', 'general', 'red', 500, '#112233');
                INSERT INTO token_groups (id, design_system_id, kind, code, label, position)
                    VALUES ('$TOKEN_GROUP', '$DS', 'color', 'text', 'Original', 0);
                INSERT INTO tokens (id, design_system_id, name, type, group_id, position)
                    VALUES ('$TOKEN', '$DS', 'text.default.primary', 'color', '$TOKEN_GROUP', 7);
                INSERT INTO tenant_palette_groups (id, tenant_id, kind, label, position)
                    VALUES ('$GROUP', '$TENANT', 'custom', 'custom', 0);
                INSERT INTO tenant_palette_ramps (id, group_id, slot_type, slot_shade, source_type, source_shade)
                    VALUES ('$RAMP', '$GROUP', 'general', 'red', 'general', 'red');
                INSERT INTO tenant_palette_steps VALUES ('$RAMP', 500, '#123456');
                INSERT INTO tenant_palette_token_groups VALUES ('$TENANT', '$TOKEN', '$GROUP');
                """.trimIndent(),
            )
        }
    }

    private fun flyway(postgres: PostgreSQLContainer<Nothing>, target: String = "latest") = Flyway.configure()
        .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
        .locations("classpath:db/migration").target(target).load()

    private fun connection(postgres: PostgreSQLContainer<Nothing>): Connection =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password)

    private fun scalar(connection: Connection, query: String): String = connection.createStatement().use { statement ->
        statement.executeQuery(query).use { rows ->
            check(rows.next())
            rows.getString(1)
        }
    }

    private companion object {
        const val DS = "11111111-1111-4111-8111-111111111111"
        const val TENANT = "22222222-2222-4222-8222-222222222222"
        const val TOKEN = "33333333-3333-4333-8333-333333333333"
        const val GROUP = "44444444-4444-4444-8444-444444444444"
        const val RAMP = "55555555-5555-4555-8555-555555555555"
        const val TOKEN_GROUP = "66666666-6666-4666-8666-666666666666"
    }
}
