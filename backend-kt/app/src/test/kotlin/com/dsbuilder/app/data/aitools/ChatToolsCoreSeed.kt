package com.dsbuilder.app.data.aitools

import org.testcontainers.containers.PostgreSQLContainer
import java.sql.DriverManager
import java.util.UUID

/** Явно выбирает тестовый Core из каталога фикстуры для инструментов чата. */
internal object ChatToolsCoreSeed {
    /** Фиксирует каталог, созданный ChatToolsComponentSeed, только в черновике сценария. */
    fun capture(postgres: PostgreSQLContainer<Nothing>, system: String) {
        val release = UUID.randomUUID()
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.autoCommit = false
            connection.createStatement().use { statement ->
                statement.executeUpdate(
                    "INSERT INTO core_releases(id, library_id, platform, version, normalized_meta, provenance) " +
                        "VALUES ('$release', 'fixture:web', 'web', '$release', '{}', 'migration-snapshot')",
                )
                statement.executeUpdate(
                    "INSERT INTO core_release_components SELECT '$release', id, name, description " +
                        "FROM components WHERE platform = 'web'",
                )
                statement.executeUpdate(
                    "INSERT INTO core_release_properties " +
                        "SELECT '$release', p.id, p.component_id, p.name, p.type, " +
                        "p.default_value, p.description, '[]' " +
                        "FROM properties p JOIN core_release_components c ON c.component_id = p.component_id " +
                        "WHERE c.release_id = '$release'",
                )
                statement.executeUpdate(
                    "INSERT INTO core_release_states SELECT '$release', s.id, s.component_id, s.name, s.description " +
                        "FROM states s JOIN core_release_components c ON c.component_id = s.component_id " +
                        "WHERE c.release_id = '$release'",
                )
                statement.executeUpdate(
                    "INSERT INTO core_release_platform_params " +
                        "SELECT '$release', a.id, a.property_id, a.name, a.deprecated, a.deprecated_message " +
                        "FROM property_platform_params a " +
                        "JOIN core_release_properties p ON p.property_id = a.property_id " +
                        "WHERE p.release_id = '$release' AND a.platform = 'web'",
                )
                statement.executeUpdate(
                    "INSERT INTO design_system_version_core_releases(version_id, platform, release_id) " +
                        "SELECT id, 'web', '$release' FROM design_system_versions " +
                        "WHERE design_system_id = '$system' AND status = 'draft' " +
                        "ON CONFLICT (version_id, platform) DO UPDATE SET release_id = EXCLUDED.release_id",
                )
            }
            connection.commit()
        }
    }
}
