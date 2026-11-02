package com.dsbuilder.ds.app

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.application.DraftChangeLimitExceededException
import com.dsbuilder.ds.designsystems.data.ExposedDraftChangeRepository
import com.dsbuilder.ds.designsystems.data.designSystemDraftChangeHandler
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.themes.data.themeDraftChangeHandlers
import com.dsbuilder.ds.themes.data.themeDraftChangePolicy
import com.dsbuilder.ds.tokens.data.tokenDraftChangeHandlers
import kotlinx.coroutines.runBlocking
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class CompactJournalPostgresIntegrationTest {
    @Test
    fun `compact projections work above full journal limit and isolate tenants and projects`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            val database = Database.connect(
                postgres.jdbcUrl,
                driver = "org.postgresql.Driver",
                user = postgres.username,
                password = postgres.password,
            )
            val owner = UUID.randomUUID()
            val baseline = UUID.randomUUID()
            val draft = UUID.randomUUID()
            val tenant = UUID.randomUUID()
            transaction(db = database) {
                exec(
                    """
    INSERT INTO design_systems(id, project_name, project_id) VALUES ('$owner', 'fixture',
    'project')
                    """.trimIndent(),
                )
                exec(
                    """
    INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, revision,
    published_at) VALUES ('$baseline', '$owner', 'baseline', 0, 0, NULL)
                    """.trimIndent(),
                )
                exec(
                    """
    INSERT INTO design_system_revisions(design_system_id, design_system_version_id,
    version_sequence_number, name) VALUES ('$owner', '$baseline', 0, 'Fixture')
                    """.trimIndent(),
                )
                exec("INSERT INTO tenants(id, design_system_id) VALUES ('$tenant', '$owner')")
                exec(
                    """
    INSERT INTO tenant_revisions(tenant_id, design_system_id, design_system_version_id,
    version_sequence_number, name) VALUES ('$tenant', '$owner', '$baseline', 0, 'Theme')
                    """.trimIndent(),
                )
                exec(
                    """
    INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, revision,
    published_at) VALUES ('$draft', '$owner', 'draft', 1, 0, NULL)
                    """.trimIndent(),
                )
                exec(
                    """
    INSERT INTO tokens(id, design_system_id) SELECT gen_random_uuid(), '$owner'::uuid FROM
    generate_series(1,10001)
                    """.trimIndent(),
                )
                exec(
                    """
    INSERT INTO token_revisions(token_id, design_system_id, design_system_version_id,
    version_sequence_number, name, type, display_name, enabled) SELECT id, '$owner'::uuid,
    '$draft'::uuid, 1, 'color.' || id::text, 'color', 'Color', true FROM tokens WHERE
    design_system_id = '$owner'
                    """.trimIndent(),
                )
            }
            val journal = ExposedDraftChangeRepository(
                listOf(designSystemDraftChangeHandler()) + themeDraftChangeHandlers() + tokenDraftChangeHandlers(),
                listOf(themeDraftChangePolicy()),
            )
            transaction(db = database) {
                runBlocking {
                    val id = DesignSystemId(owner)
                    assertFailsWith<DraftChangeLimitExceededException> {
                        journal.list(
                            ProjectId("project"),
                            false,
                            id,
                            null,
                        )
                    }
                    assertEquals(10001, journal.summary(ProjectId("project"), false, id, null))
                    assertEquals(10001, journal.changedTokenIds(ProjectId("project"), false, id, null, tenant)?.size)
                    assertEquals(null, journal.summary(ProjectId("another"), false, id, null))
                    assertEquals(
                        null,
                        journal.changedTokenIds(ProjectId("project"), false, id, null, UUID.randomUUID()),
                    )
                }
            }
        }
    }
}
