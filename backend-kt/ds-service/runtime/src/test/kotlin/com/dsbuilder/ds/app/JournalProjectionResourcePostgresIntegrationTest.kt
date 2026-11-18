package com.dsbuilder.ds.app

import com.dsbuilder.ds.core.application.DraftChangeHandler
import com.dsbuilder.ds.core.application.DraftChangePolicy
import com.dsbuilder.ds.core.application.DraftSubjectChange
import com.dsbuilder.ds.core.application.JournalProjectionHandler
import com.dsbuilder.ds.core.data.BatchJdbc
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.data.ExposedDraftChangeRepository
import com.dsbuilder.ds.designsystems.data.designSystemDraftChangeHandler
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.themes.data.ThemeJournalCandidateProjection
import com.dsbuilder.ds.themes.data.themeDraftChangeHandlers
import com.dsbuilder.ds.themes.data.themeDraftChangePolicy
import com.dsbuilder.ds.tokens.data.tokenDraftChangeHandlers
import kotlinx.coroutines.runBlocking
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import java.io.File
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Результат зависит от видимых правок; скрытые создания не попадают в подробный обработчик. */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class JournalProjectionResourcePostgresIntegrationTest {
    @Test
    fun `compound values and platform overrides retain legacy display counts`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            val db = Database.connect(postgres.jdbcUrl, user = postgres.username, password = postgres.password)
            for (type in listOf("typography", "gradient", "shadow")) {
                transaction(db = db) {
                    val fixture = JournalProjectionSqlFixture(tokenType = type)
                    fixture.value("""{"fontSize":12,"lineHeight":16}""", """{"fontSize":14,"lineHeight":20}""")
                    fixture.value("[1]", "[2]", platform = "ios", mode = "dark", overridden = true)
                    fixture.value("[1]", "[1]", deleted = true)
                    val handlers = listOf(designSystemDraftChangeHandler()) +
                        themeDraftChangeHandlers() +
                        tokenDraftChangeHandlers()
                    val old = ExposedDraftChangeRepository(handlers, listOf(themeDraftChangePolicy()))
                    val projected = ExposedDraftChangeRepository(
                        handlers,
                        listOf(themeDraftChangePolicy()),
                        journalProjections = listOf(ThemeJournalCandidateProjection()),
                    )
                    runBlocking {
                        val owner = DesignSystemId(fixture.owner)
                        assertEquals(
                            old.summary(
                                ProjectId("project"),
                                false,
                                owner,
                                null,
                            ),
                            projected.summary(
                                ProjectId("project"),
                                false,
                                owner,
                                null,
                            ),
                        )
                        assertEquals(
                            old.changedTokenIds(
                                ProjectId("project"),
                                false,
                                owner,
                                null,
                                fixture.newTenant,
                            ),
                            projected.changedTokenIds(
                                ProjectId("project"),
                                false,
                                owner,
                                null,
                                fixture.newTenant,
                            ),
                        )
                    }
                }
            }
        }
    }

    @Test
    fun `hidden growth does not hydrate unchanged values and unsupported wrappers keep their filters`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            val db = Database.connect(postgres.jdbcUrl, user = postgres.username, password = postgres.password)
            val evidence = mutableListOf<String>()
            for (size in listOf(1000, 10000, 50000)) {
                transaction(db = db) {
                    val fixture = JournalProjectionSqlFixture(size + 9)
                    val changed = List(9) { fixture.value("[1]", "[2]") }.toSet()
                    fixture.seedUnchanged(size)
                    exec("ANALYZE")
                    val sql = requireNotNull(javaClass.getResource("/dsbuilder/ds/seeds/journal-candidates.sql"))
                        .readText()
                    val plan = BatchJdbc().read(
                        "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) $sql",
                        fixture.owner,
                        fixture.draft,
                        1L,
                        0L,
                        null,
                        null,
                    ) { it.getString(1) }.single()
                    File("/tmp/journal-growth-$size-plan.json").writeText(plan)
                    val decoded = mutableListOf<UUID>()
                    val base = tokenDraftChangeHandlers()
                    val handler = base.single { it.entityType == "token-value" }
                    val observed = object : DraftChangeHandler by handler, JournalProjectionHandler {
                        override fun describeEntities(
                            designSystemId: UUID,
                            sequenceNumber: Long,
                            previousSequenceNumber: Long,
                            entityIds: Set<UUID>,
                        ): List<DraftSubjectChange> {
                            decoded.addAll(entityIds)
                            return handler.describeEntities(
                                designSystemId,
                                sequenceNumber,
                                previousSequenceNumber,
                                entityIds,
                            )
                        }
                    }
                    val handlers = listOf(designSystemDraftChangeHandler()) + themeDraftChangeHandlers() +
                        base.filter { it.entityType != "token-value" } + observed
                    val policy = themeDraftChangePolicy()
                    val projected = ExposedDraftChangeRepository(
                        handlers,
                        listOf(policy),
                        journalProjections = listOf(ThemeJournalCandidateProjection()),
                    )
                    val legacy = ExposedDraftChangeRepository(handlers, listOf(policy))
                    runBlocking {
                        val owner = DesignSystemId(fixture.owner)
                        assertEquals(10, projected.summary(ProjectId("project"), false, owner, null))
                        assertEquals(
                            9,
                            projected.changedTokenIds(
                                ProjectId("project"),
                                false,
                                owner,
                                null,
                                fixture.newTenant,
                            )?.size,
                        )
                        assertEquals(changed, decoded.toSet())
                        assertEquals(18, decoded.size)
                        assertEquals(
                            legacy.summary(
                                ProjectId("project"),
                                false,
                                owner,
                                null,
                            ),
                            projected.summary(
                                ProjectId("project"),
                                false,
                                owner,
                                null,
                            ),
                        )
                        if (size == 1000) {
                            val unknown = DraftChangePolicy { _, candidates -> candidates }
                            assertFalse(ThemeJournalCandidateProjection().supports(listOf(policy, unknown)))
                            val fallback = ExposedDraftChangeRepository(
                                handlers,
                                listOf(
                                    policy,
                                    unknown,
                                ),
                                journalProjections = listOf(ThemeJournalCandidateProjection()),
                            )
                            assertEquals(10, fallback.summary(ProjectId("project"), false, owner, null))
                            val filtered = object : DraftChangeHandler by handler {
                                override fun visit(
                                    designSystemId: UUID,
                                    sequenceNumber: Long,
                                    previousSequenceNumber: Long,
                                    consume: (List<DraftSubjectChange>) -> Unit,
                                ) {
                                    handler.visit(
                                        designSystemId,
                                        sequenceNumber,
                                        previousSequenceNumber,
                                    ) { consume(it.filter { row -> row.entityId !in changed }) }
                                }
                            }
                            val filteredRepository =
                                ExposedDraftChangeRepository(
                                    handlers.filter { it.entityType != "token-value" } + filtered,
                                    listOf(policy),
                                    journalProjections = listOf(ThemeJournalCandidateProjection()),
                                )
                            assertEquals(1, filteredRepository.summary(ProjectId("project"), false, owner, null))
                            assertTrue(
                                filteredRepository.changedTokenIds(
                                    ProjectId("project"),
                                    false,
                                    owner,
                                    null,
                                    fixture.newTenant,
                                ).orEmpty().isEmpty(),
                            )
                        }
                        evidence += "hidden=$size changed=9 hydratedPerRead=9 summary=10 marks=9"
                    }
                }
            }
            File("/tmp/journal-resource-growth.txt").writeText(evidence.joinToString("\n"))
        }
    }
}
