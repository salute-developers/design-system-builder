@file:Suppress("ktlint:standard:max-line-length")

package com.dsbuilder.ds.app

import com.dsbuilder.ds.core.data.coreCatalogSql
import com.dsbuilder.ds.core.data.lockDraftCoreSelection
import com.dsbuilder.testing.IntegrationTest
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.junit.experimental.categories.Category
import java.sql.Connection
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Регрессии ревью: разделяемые записи и постоянная стоимость разрешения Core при росте истории. */
@Category(IntegrationTest::class)
class CoreReviewPostgresIntegrationTest {
    @Test
    fun `ordinary edits share the barrier and catalog resolves once per platform across fifty releases`() {
        IsolatedPostgresDatabase.create().use { db ->
            val system = UUID.randomUUID()
            val draft = UUID.randomUUID()
            val component = UUID.randomUUID()
            val property = UUID.randomUUID()
            DriverManager.getConnection(db.jdbcUrl, db.username, db.password).use { c ->
                c.createStatement().use { s ->
                    s.execute(
                        "INSERT INTO design_systems(id, project_name, project_id) VALUES ('$system', 'review', 'project')",
                    )
                    s.execute(
                        "INSERT INTO design_system_versions(design_system_id, status, sequence_number, revision, published_at) VALUES ('$system', 'baseline', 0, 0, NULL)",
                    )
                    s.execute(
                        "INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, revision, published_at) VALUES ('$draft', '$system', 'draft', 1, 0, NULL)",
                    )
                    s.execute(
                        "INSERT INTO design_system_revisions(design_system_id, design_system_version_id, version_sequence_number, name, deleted) VALUES ('$system', '$draft', 1, 'review', false)",
                    )
                    s.execute("INSERT INTO components(id, name, platform) VALUES ('$component', 'Review', 'compose')")
                    s.execute(
                        "INSERT INTO properties(id, component_id, name, type) VALUES ('$property', '$component', 'height', 'dimension')",
                    )
                    s.execute(
                        "INSERT INTO core_releases(library_id, platform, version, normalized_meta, provenance) SELECT 'fixture:compose', 'compose', n::text, '[]', 'migration-snapshot' FROM generate_series(1,50) n",
                    )
                    s.execute(
                        "INSERT INTO core_release_components SELECT id, '$component', 'Review', NULL FROM core_releases WHERE library_id = 'fixture:compose'",
                    )
                    s.execute(
                        "INSERT INTO core_release_properties(release_id, property_id, component_id, name, type) SELECT id, '$property', '$component', 'height', 'dimension' FROM core_releases WHERE library_id = 'fixture:compose'",
                    )
                    s.execute(
                        "INSERT INTO design_system_version_core_releases SELECT '$draft', 'compose', id, 'pinned' FROM core_releases WHERE library_id = 'fixture:compose' AND version = '50'",
                    )
                    s.execute("CREATE SEQUENCE resolution_calls")
                    s.execute(
                        "ALTER FUNCTION ds_selected_core_release(component_platform) RENAME TO original_selected_core_release",
                    )
                    s.execute(
                        "CREATE FUNCTION ds_selected_core_release(p component_platform) RETURNS uuid LANGUAGE plpgsql STABLE AS $$ BEGIN PERFORM nextval('resolution_calls'); RETURN original_selected_core_release(p); END; $$",
                    )
                }
            }
            val database = Database.connect(
                db.jdbcUrl,
                driver = "org.postgresql.Driver",
                user = db.username,
                password = db.password,
            )
            transaction(database) {
                exec("SELECT set_config('ds.design_system_id', '$system', true)")
                exec("SELECT set_config('ds.project_id', 'project', true)")
                lockDraftCoreSelection(system)
                DriverManager.getConnection(db.jdbcUrl, db.username, db.password).use { other ->
                    other.autoCommit = false
                    assertEquals(
                        "t",
                        scalar(other, "SELECT pg_try_advisory_xact_lock_shared(hashtextextended('$system', 684313))"),
                    )
                    assertEquals(
                        "f",
                        scalar(other, "SELECT pg_try_advisory_xact_lock(hashtextextended('$system', 684313))"),
                    )
                    other.rollback()
                }
                val catalog =
                    coreCatalogSql(
                        "properties",
                        "core_release_properties",
                        "property_id",
                        listOf("component_id", "name", "type", "default_value", "description"),
                    )
                assertEquals(
                    1,
                    exec("SELECT count(*) FROM ($catalog) catalog") { r ->
                        r.next()
                        r.getInt(1)
                    },
                )
                val calls = exec("SELECT last_value FROM resolution_calls") { r ->
                    r.next()
                    r.getInt(1)
                }!!
                assertTrue(calls <= 4, "Core resolution calls for 50 snapshots: $calls")
                println("Core catalog: 50 releases, $calls resolution calls")
            }
        }
    }

    private fun scalar(connection: Connection, sql: String): String = connection.createStatement().use { s ->
        s.executeQuery(sql).use { r ->
            check(r.next())
            r.getString(1)
        }
    }
}
