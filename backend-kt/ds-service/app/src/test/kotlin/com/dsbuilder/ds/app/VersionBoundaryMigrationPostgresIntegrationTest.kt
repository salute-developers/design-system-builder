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

class VersionBoundaryMigrationPostgresIntegrationTest {
    @Test
    fun `legacy snapshots stay archived and new boundaries obey their lifecycle`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            flyway(postgres, "3").migrate()
            val fixture = seed(connection(postgres))

            flyway(postgres, null).migrate()

            connection(postgres).use { connection ->
                assertEquals(
                    "2",
                    scalar(
                        connection,
                        "SELECT count(*) FROM design_system_versions " +
                            "WHERE design_system_id = '${fixture.designSystemId}' " +
                            "AND snapshot IS NOT NULL AND status IS NULL " +
                            "AND sequence_number IS NULL AND revision IS NULL",
                    ),
                )

                assertEquals(
                    "1",
                    scalar(
                        connection,
                        "SELECT count(*) FROM design_system_versions " +
                            "WHERE design_system_id = '${fixture.designSystemId}' AND status = 'baseline'",
                    ),
                )
                assertEquals(
                    "1",
                    scalar(
                        connection,
                        "SELECT count(*) FROM design_system_versions " +
                            "WHERE design_system_id = '${fixture.designSystemId}' AND status = 'draft'",
                    ),
                )
                assertEquals(
                    "Fixture",
                    scalar(
                        connection,
                        "SELECT revision.name FROM design_system_revisions revision " +
                            "JOIN design_system_versions boundary ON boundary.id = revision.design_system_version_id " +
                            "WHERE boundary.design_system_id = '${fixture.designSystemId}' " +
                            "AND boundary.status = 'baseline'",
                    ),
                )
                assertEquals(
                    "surface",
                    scalar(
                        connection,
                        "SELECT revision.name FROM token_revisions revision " +
                            "JOIN design_system_versions boundary ON boundary.id = revision.design_system_version_id " +
                            "WHERE revision.token_id = '${fixture.tokenId}' AND boundary.status = 'baseline'",
                    ),
                )
                assertEquals(
                    "2020-01-02 03:04:05",
                    scalar(
                        connection,
                        "SELECT revision.updated_at::text FROM token_revisions revision " +
                            "JOIN design_system_versions boundary ON boundary.id = revision.design_system_version_id " +
                            "WHERE revision.token_id = '${fixture.tokenId}' AND boundary.status = 'baseline'",
                    ),
                )
                assertEquals(
                    "1",
                    scalar(
                        connection,
                        "SELECT revision.value::text FROM token_value_revisions revision " +
                            "JOIN design_system_versions boundary ON boundary.id = revision.design_system_version_id " +
                            "WHERE revision.token_value_id = '${fixture.tokenValueId}' " +
                            "AND boundary.status = 'baseline'",
                    ),
                )
                assertEquals("#fff", scalar(connection, "SELECT value FROM palette WHERE id = '${fixture.paletteId}'"))
                assertEquals(
                    "Documentation",
                    scalar(
                        connection,
                        "SELECT content FROM documentation_pages WHERE id = '${fixture.documentationId}'",
                    ),
                )
                assertEquals(
                    "0",
                    scalar(connection, "SELECT count(*) FROM pg_class WHERE relname = 'saved_queries'"),
                )

                assertFailsWith<SQLException> {
                    update(
                        connection,
                        "INSERT INTO design_system_versions(" +
                            "design_system_id, version, snapshot, publication_status, published_at, " +
                            "status, sequence_number, revision" +
                            ") VALUES ('${fixture.designSystemId}', NULL, NULL, NULL, NULL, 'draft', 2, 0)",
                    )
                }
                assertFailsWith<SQLException> {
                    update(
                        connection,
                        "INSERT INTO design_system_versions(" +
                            "design_system_id, version, snapshot, publication_status, published_at, " +
                            "status, sequence_number, revision" +
                            ") VALUES ('${fixture.designSystemId}', NULL, NULL, NULL, now(), 'published', 2, 0)",
                    )
                }

                val actorId = UUID.randomUUID()
                update(
                    connection,
                    "INSERT INTO entity_edit_states(" +
                        "design_system_version_id, design_system_id, entity_type, entity_id, last_actor_id" +
                        ") SELECT id, design_system_id, 'tenant', '${fixture.tenantId}', '$actorId' " +
                        "FROM design_system_versions WHERE design_system_id = '${fixture.designSystemId}' " +
                        "AND status = 'draft'",
                )
                update(
                    connection,
                    "INSERT INTO idempotent_requests(" +
                        "project_id, idempotency_key, actor_id, operation, request_hash, response_status, " +
                        "response_body" +
                        ") VALUES ('project', 'key', '$actorId', 'publish', 'hash', 200, '{}'::jsonb)",
                )
                assertFailsWith<SQLException> {
                    update(
                        connection,
                        "INSERT INTO idempotent_requests(" +
                            "project_id, idempotency_key, actor_id, operation, request_hash, response_status, " +
                            "response_body" +
                            ") VALUES ('project', 'key', '$actorId', 'publish', 'hash', 200, '{}'::jsonb)",
                    )
                }

                val revisionTables = listOf(
                    "design_system_revisions",
                    "tenant_revisions",
                    "token_revisions",
                    "token_value_revisions",
                    "design_system_component_revisions",
                    "appearance_revisions",
                    "style_revisions",
                    "component_reuse_config_revisions",
                    "appearance_variation_revisions",
                    "appearance_variation_value_revisions",
                    "appearance_combination_revisions",
                    "appearance_combination_member_revisions",
                    "invariant_property_value_revisions",
                    "invariant_platform_param_adjustment_revisions",
                    "variation_property_value_revisions",
                    "variation_platform_param_adjustment_revisions",
                    "style_combination_revisions",
                    "style_combination_member_revisions",
                    "component_style_reference_revisions",
                    "component_style_reference_style_revisions",
                )
                revisionTables.forEach { table ->
                    assertEquals(table, scalar(connection, "SELECT '$table'::regclass"))
                    assertEquals(
                        "1",
                        scalar(
                            connection,
                            "SELECT count(*) FROM information_schema.columns " +
                                "WHERE table_name = '$table' AND column_name = 'updated_at'",
                        ),
                    )
                }
                assertEquals(
                    "0",
                    scalar(
                        connection,
                        "SELECT count(*) FROM information_schema.columns " +
                            "WHERE table_name = 'appearance_revisions' AND column_name = 'platform'",
                    ),
                )
                assertEquals(
                    "0",
                    scalar(
                        connection,
                        "SELECT count(*) FROM information_schema.columns " +
                            "WHERE table_name = 'appearance_variation_revisions' " +
                            "AND column_name = 'is_color_scheme'",
                    ),
                )

                val immutableTokenId = UUID.randomUUID()
                update(
                    connection,
                    "INSERT INTO tokens(id, design_system_id) " +
                        "VALUES ('$immutableTokenId', '${fixture.designSystemId}')",
                )
                assertFailsWith<SQLException> {
                    update(
                        connection,
                        "INSERT INTO token_revisions(" +
                            "token_id, design_system_id, design_system_version_id, version_sequence_number, " +
                            "name, type, enabled, deleted" +
                            ") SELECT '$immutableTokenId', '${fixture.designSystemId}', id, sequence_number, " +
                            "'baseline-write', 'color', true, false FROM design_system_versions " +
                            "WHERE design_system_id = '${fixture.designSystemId}' AND status = 'baseline'",
                    )
                }
                val immutablePublishedId = UUID.randomUUID()
                assertFailsWith<SQLException> {
                    update(
                        connection,
                        "INSERT INTO design_system_versions(" +
                            "id, design_system_id, version, status, sequence_number, revision, published_at" +
                            ") VALUES ('$immutablePublishedId', '${fixture.designSystemId}', " +
                            "'immutable-check', 'published', 2, 0, now())",
                    )
                }

                val currentViews = listOf(
                    "current_design_systems",
                    "current_tenants",
                    "current_tokens",
                    "current_token_values",
                    "current_design_system_components",
                    "current_appearances",
                    "current_styles",
                    "current_component_reuse_configs",
                    "current_appearance_variations",
                    "current_appearance_variation_values",
                    "current_appearance_combinations",
                    "current_appearance_combination_members",
                    "current_invariant_property_values",
                    "current_invariant_platform_param_adjustments",
                    "current_variation_property_values",
                    "current_variation_platform_param_adjustments",
                    "current_style_combinations",
                    "current_style_combination_members",
                    "current_component_style_references",
                    "current_component_style_reference_styles",
                )
                assertEquals(
                    "0",
                    scalar(
                        connection,
                        "SELECT count(*) FROM pg_class WHERE relname IN (" +
                            currentViews.joinToString(",") { "'$it'" } + ")",
                    ),
                )
                assertEquals(
                    "0",
                    scalar(
                        connection,
                        "SELECT count(*) FROM information_schema.columns " +
                            "WHERE table_name = 'tokens' AND column_name IN ('name', 'type', 'enabled')",
                    ),
                )
                val resolvedTokenName =
                    "SELECT revision.name FROM tokens entity " +
                        "JOIN design_system_versions draft ON draft.design_system_id = entity.design_system_id " +
                        "AND draft.status = 'draft' " +
                        "JOIN token_revisions revision ON revision.token_id = entity.id " +
                        "AND revision.version_sequence_number <= draft.sequence_number " +
                        "WHERE entity.id = '${fixture.tokenId}' AND NOT revision.deleted " +
                        "ORDER BY revision.version_sequence_number DESC LIMIT 1"
                assertEquals("surface", scalar(connection, resolvedTokenName))
                update(
                    connection,
                    "INSERT INTO token_revisions(" +
                        "token_id, design_system_id, design_system_version_id, version_sequence_number, " +
                        "name, type, display_name, description, enabled, deleted) " +
                        "SELECT '${fixture.tokenId}', '${fixture.designSystemId}', draft.id, draft.sequence_number, " +
                        "'surface-updated', baseline.type, baseline.display_name, baseline.description, " +
                        "baseline.enabled, false FROM design_system_versions draft " +
                        "JOIN token_revisions baseline ON baseline.token_id = '${fixture.tokenId}' " +
                        "AND baseline.version_sequence_number = 0 " +
                        "WHERE draft.design_system_id = '${fixture.designSystemId}' AND draft.status = 'draft'",
                )
                assertEquals(
                    "surface-updated",
                    scalar(connection, resolvedTokenName),
                )
                assertEquals(
                    "surface",
                    scalar(
                        connection,
                        "SELECT revision.name FROM token_revisions revision " +
                            "JOIN design_system_versions boundary ON boundary.id = revision.design_system_version_id " +
                            "WHERE revision.token_id = '${fixture.tokenId}' AND boundary.status = 'baseline'",
                    ),
                )
                update(
                    connection,
                    "DELETE FROM token_revisions WHERE token_id = '${fixture.tokenId}' " +
                        "AND version_sequence_number = 1",
                )
                update(
                    connection,
                    "INSERT INTO token_revisions(" +
                        "token_id, design_system_id, design_system_version_id, version_sequence_number, " +
                        "name, type, display_name, description, enabled, deleted) " +
                        "SELECT '${fixture.tokenId}', '${fixture.designSystemId}', draft.id, draft.sequence_number, " +
                        "'surface', baseline.type, baseline.display_name, baseline.description, " +
                        "baseline.enabled, false " +
                        "FROM design_system_versions draft " +
                        "JOIN token_revisions baseline ON baseline.token_id = '${fixture.tokenId}' " +
                        "AND baseline.version_sequence_number = 0 " +
                        "WHERE draft.design_system_id = '${fixture.designSystemId}' AND draft.status = 'draft'",
                )
                assertEquals(
                    "0",
                    scalar(
                        connection,
                        "SELECT count(*) FROM token_revisions WHERE token_id = '${fixture.tokenId}' " +
                            "AND version_sequence_number = 1",
                    ),
                )
                assertEquals(
                    "1",
                    scalar(
                        connection,
                        "SELECT count(*) FROM entity_edit_states WHERE entity_type = 'token' " +
                            "AND entity_id = '${fixture.tokenId}' AND revision > 0",
                    ),
                )

                val transientTokenId = UUID.randomUUID()
                update(
                    connection,
                    "INSERT INTO tokens(id, design_system_id) " +
                        "VALUES ('$transientTokenId', '${fixture.designSystemId}')",
                )
                update(
                    connection,
                    "INSERT INTO token_revisions(" +
                        "token_id, design_system_id, design_system_version_id, version_sequence_number, " +
                        "name, type, enabled, deleted) " +
                        "SELECT '$transientTokenId', '${fixture.designSystemId}', id, sequence_number, " +
                        "'transient', 'color', true, false FROM design_system_versions " +
                        "WHERE design_system_id = '${fixture.designSystemId}' AND status = 'draft'",
                )
                update(
                    connection,
                    "DELETE FROM token_revisions WHERE token_id = '$transientTokenId' AND version_sequence_number = 1",
                )
                update(
                    connection,
                    "INSERT INTO token_revisions(" +
                        "token_id, design_system_id, design_system_version_id, version_sequence_number, " +
                        "name, type, enabled, deleted) " +
                        "SELECT '$transientTokenId', '${fixture.designSystemId}', id, sequence_number, " +
                        "'transient', 'color', true, true FROM design_system_versions " +
                        "WHERE design_system_id = '${fixture.designSystemId}' AND status = 'draft'",
                )
                assertEquals("0", scalar(connection, "SELECT count(*) FROM tokens WHERE id = '$transientTokenId'"))

                val otherDesignSystem = UUID.randomUUID()
                val otherBaseline = UUID.randomUUID()
                update(
                    connection,
                    "INSERT INTO design_systems(id, project_name) VALUES ('$otherDesignSystem', 'other')",
                )
                update(
                    connection,
                    "INSERT INTO design_system_versions(" +
                        "id, design_system_id, version, snapshot, publication_status, published_at, " +
                        "status, sequence_number, revision" +
                        ") VALUES ('$otherBaseline', '$otherDesignSystem', NULL, NULL, NULL, NULL, " +
                        "'baseline', 0, 0)",
                )
                assertFailsWith<SQLException> {
                    update(
                        connection,
                        "INSERT INTO tenant_revisions(" +
                            "tenant_id, design_system_id, design_system_version_id, version_sequence_number, name" +
                            ") VALUES ('${fixture.tenantId}', '$otherDesignSystem', '$otherBaseline', 0, 'wrong')",
                    )
                }
                assertFailsWith<SQLException> {
                    update(
                        connection,
                        "INSERT INTO design_system_component_revisions(" +
                            "design_system_component_id, design_system_id, design_system_version_id, " +
                            "version_sequence_number" +
                            ") VALUES ('${fixture.designSystemComponentId}', '$otherDesignSystem', " +
                            "'$otherBaseline', 0)",
                    )
                }

                val protectedSharedReferences = listOf(
                    "design_system_components_component_id_components_id_fk",
                    "appearances_component_id_components_id_fk",
                    "component_reuse_configs_component_dep_id_component_deps_id_fk",
                    "invariant_property_values_property_id_properties_id_fk",
                    "invariant_property_values_component_id_components_id_fk",
                    "variation_property_values_property_id_properties_id_fk",
                    "style_combinations_property_id_properties_id_fk",
                    "invariant_platform_param_adjustments_platform_param_id_property_platform_params_id_fk",
                    "variation_platform_param_adjustments_platform_param_id_property_platform_params_id_fk",
                    "ipvr_state_set_fk",
                    "vpvr_state_set_fk",
                    "scr_state_set_fk",
                )
                protectedSharedReferences.forEach { constraint ->
                    assertEquals(
                        "RESTRICT",
                        scalar(
                            connection,
                            "SELECT delete_rule FROM information_schema.referential_constraints " +
                                "WHERE constraint_name = '$constraint'",
                        ),
                        constraint,
                    )
                }
                update(
                    connection,
                    "INSERT INTO design_system_component_revisions(" +
                        "design_system_component_id, design_system_id, design_system_version_id, " +
                        "version_sequence_number, deleted" +
                        ") SELECT '${fixture.designSystemComponentId}', '${fixture.designSystemId}', " +
                        "id, sequence_number, true FROM design_system_versions " +
                        "WHERE design_system_id = '${fixture.designSystemId}' AND status = 'draft'",
                )
                assertFailsWith<SQLException> {
                    update(connection, "DELETE FROM components WHERE id = '${fixture.componentId}'")
                }
            }
        }
    }

    private fun seed(connection: Connection): Fixture {
        val fixture = Fixture()
        update(
            connection,
            "INSERT INTO design_systems(id, name, project_name) " +
                "VALUES ('${fixture.designSystemId}', 'Fixture', 'fixture')",
        )
        update(
            connection,
            "INSERT INTO design_system_versions(design_system_id, version, snapshot) VALUES " +
                "('${fixture.designSystemId}', '1.0.0', '{\"tokens\":[]}'::jsonb), " +
                "('${fixture.designSystemId}', '1.1.0', '{\"tokens\":[1]}'::jsonb)",
        )
        update(
            connection,
            "INSERT INTO tenants(id, design_system_id, name) " +
                "VALUES ('${fixture.tenantId}', '${fixture.designSystemId}', 'Default')",
        )
        update(
            connection,
            "INSERT INTO tokens(id, design_system_id, name, updated_at) " +
                "VALUES ('${fixture.tokenId}', '${fixture.designSystemId}', 'surface', " +
                "TIMESTAMP '2020-01-02 03:04:05')",
        )
        update(
            connection,
            "INSERT INTO palette(id, type, shade, saturation, value) " +
                "VALUES ('${fixture.paletteId}', 'general', '100', 100, '#fff')",
        )
        update(
            connection,
            "INSERT INTO token_values(id, token_id, tenant_id, palette_id, value) " +
                "VALUES ('${fixture.tokenValueId}', '${fixture.tokenId}', '${fixture.tenantId}', " +
                "'${fixture.paletteId}', '1'::jsonb)",
        )
        update(
            connection,
            "INSERT INTO components(id, name, platform) " +
                "VALUES ('${fixture.componentId}', 'FixtureComponent', 'web')",
        )
        update(
            connection,
            "INSERT INTO design_system_components(id, design_system_id, component_id) " +
                "VALUES ('${fixture.designSystemComponentId}', '${fixture.designSystemId}', '${fixture.componentId}')",
        )
        update(
            connection,
            "INSERT INTO documentation_pages(id, design_system_id, content) " +
                "VALUES ('${fixture.documentationId}', '${fixture.designSystemId}', 'Documentation')",
        )
        update(
            connection,
            "INSERT INTO saved_queries(id, label, sql) " +
                "VALUES ('${fixture.savedQueryId}', 'Fixture query', 'SELECT 1')",
        )
        return fixture
    }

    private fun scalar(connection: Connection, sql: String): String =
        connection.createStatement().use { statement ->
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
        .locations("classpath:db/migration")
        .also { configuration -> target?.let(configuration::target) }
        .load()

    private class Fixture {
        val designSystemId: UUID = UUID.randomUUID()
        val tenantId: UUID = UUID.randomUUID()
        val tokenId: UUID = UUID.randomUUID()
        val tokenValueId: UUID = UUID.randomUUID()
        val componentId: UUID = UUID.randomUUID()
        val designSystemComponentId: UUID = UUID.randomUUID()
        val paletteId: UUID = UUID.randomUUID()
        val documentationId: UUID = UUID.randomUUID()
        val savedQueryId: UUID = UUID.randomUUID()
    }
}
