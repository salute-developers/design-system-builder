package com.dsbuilder.ds.app

import java.sql.DriverManager
import java.util.UUID

/** Legacy tests seed catalog rows directly; capture that exact catalog without inventing aliases or components. */
internal fun importFixtureCore(postgres: IsolatedPostgresDatabase) =
    importFixtureCore(postgres.jdbcUrl, postgres.username, postgres.password)

internal fun importFixtureCore(jdbcUrl: String, username: String, password: String) {
    DriverManager.getConnection(jdbcUrl, username, password).use { connection ->
        connection.autoCommit = false
        connection.createStatement().use { statement ->
            val platforms = statement.executeQuery("SELECT DISTINCT platform::text FROM components").use { rows ->
                buildList { while (rows.next()) add(rows.getString(1)) }
            }
            for (platform in platforms) {
                val id = UUID.randomUUID()
                statement.executeUpdate(
                    """
                    INSERT INTO core_releases(id, library_id, platform, version, normalized_meta, provenance)
                    SELECT '$id', 'fixture:$platform', '$platform', '$id',
                        jsonb_build_object('components', jsonb_agg(to_jsonb(c))), 'migration-snapshot'
                    FROM components c WHERE c.platform::text = '$platform'
                    """.trimIndent(),
                )
                statement.executeUpdate(
                    "INSERT INTO core_release_components SELECT '$id', id, name, description " +
                        "FROM components WHERE platform::text = '$platform'",
                )
                statement.executeUpdate(
                    """
                    INSERT INTO core_release_properties
                    SELECT '$id', p.id, p.component_id, p.name, p.type, p.default_value, p.description, '[]',
                        p.state_combinations, ARRAY(
                            SELECT s.state_id FROM property_supported_states s
                            WHERE s.property_id = p.id ORDER BY s.state_id
                        )
                    FROM properties p JOIN core_release_components c ON c.component_id = p.component_id
                    WHERE c.release_id = '$id'
                    """.trimIndent(),
                )
                statement.executeUpdate(
                    """
                    INSERT INTO core_release_states
                    SELECT '$id', s.id, s.component_id, s.name, s.description
                    FROM states s JOIN core_release_components c ON c.component_id = s.component_id
                    WHERE c.release_id = '$id'
                    """.trimIndent(),
                )
                statement.executeUpdate(
                    """
                    INSERT INTO core_release_platform_params
                    SELECT '$id', a.id, a.property_id, a.name, a.deprecated, a.deprecated_message
                    FROM property_platform_params a JOIN core_release_properties p ON p.property_id = a.property_id
                    WHERE p.release_id = '$id' AND a.platform::text = '$platform'
                    """.trimIndent(),
                )
                statement.executeUpdate(
                    """
                    INSERT INTO core_release_component_dependencies
                    SELECT '$id', d.id, d.parent_id, d.child_id, d.type, d."order"
                    FROM component_deps d JOIN core_release_components p ON p.component_id = d.parent_id
                    JOIN core_release_components c ON c.component_id = d.child_id
                    WHERE p.release_id = '$id' AND c.release_id = '$id' AND d.type = 'compose'
                    """.trimIndent(),
                )
                // Legacy fixtures select the catalog they seeded explicitly; production import never does this.
                statement.executeUpdate(
                    "INSERT INTO design_system_version_core_releases(version_id, platform, release_id) " +
                        "SELECT id, '$platform'::component_platform, '$id' FROM design_system_versions " +
                        "WHERE status = 'draft' ON CONFLICT (version_id, platform) " +
                        "DO UPDATE SET release_id = EXCLUDED.release_id",
                )
            }
        }
        connection.commit()
    }
}

/** Выбирает конкретный уже импортированный Core в новой ДС теста без повторного снимка каталога. */
internal fun selectImportedFixtureCore(db: IsolatedPostgresDatabase, system: String, version: String) {
    DriverManager.getConnection(db.jdbcUrl, db.username, db.password).use { connection ->
        connection.prepareStatement(
            "INSERT INTO design_system_version_core_releases(version_id,platform,release_id) " +
                "SELECT boundary.id, release.platform, release.id FROM design_system_versions boundary " +
                "CROSS JOIN core_releases release WHERE boundary.design_system_id = ?::uuid " +
                "AND boundary.status = 'draft' AND release.version = ? AND release.library_id = 'uikit-compose'",
        ).use { statement ->
            statement.setString(1, system)
            statement.setString(2, version)
            check(statement.executeUpdate() == 1)
        }
    }
}
