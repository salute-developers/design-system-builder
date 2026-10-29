package com.dsbuilder.ds.app

import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.data.ExposedTransactionRunner
import com.dsbuilder.ds.core.data.PostgresTransactionFailureMapper
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.application.CreateDesignSystemVersion
import com.dsbuilder.ds.designsystems.application.PublishDesignSystemResult
import com.dsbuilder.ds.designsystems.data.ExposedDesignSystemVersionRepository
import com.dsbuilder.ds.designsystems.data.ExposedDraftChangeRepository
import com.dsbuilder.ds.designsystems.data.designSystemDraftChangeHandler
import com.dsbuilder.ds.designsystems.domain.ChangeOperation
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionId
import com.dsbuilder.ds.designsystems.domain.DraftChangeRevertResult
import com.dsbuilder.ds.themes.data.themeDraftChangeHandlers
import com.dsbuilder.ds.themes.data.themeDraftChangePolicy
import com.dsbuilder.ds.tokens.application.UpdateToken
import com.dsbuilder.ds.tokens.data.ExposedTokenRepository
import com.dsbuilder.ds.tokens.data.tokenDraftChangeHandlers
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.postgresql.PGConnection
import java.sql.Connection
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class VersionedJournalPublicationPostgresIntegrationTest {
    @Test
    fun `partial token revert preserves neighbours bumps revision and uses new theme baseline`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            val fixture = connection(postgres).use(::seed)
            val database = Database.connect(
                url = postgres.jdbcUrl,
                driver = "org.postgresql.Driver",
                user = postgres.username,
                password = postgres.password,
            )
            val journal = testDraftChangeRepository()
            val tenantId = UUID.randomUUID()
            val valueId = UUID.randomUUID()
            transaction(database) {
                exec("INSERT INTO tenants(id, design_system_id) VALUES ('$tenantId', '${fixture.designSystemId}')")
                exec(
                    """
                    INSERT INTO tenant_revisions(tenant_id, design_system_id, design_system_version_id,
                        version_sequence_number, name, deleted)
                    VALUES ('$tenantId', '${fixture.designSystemId}', '${fixture.draftId}', 1, 'New theme', false)
                    """.trimIndent(),
                )
                exec(
                    """
                    INSERT INTO token_values(id, design_system_id, token_id, tenant_id, platform)
                    VALUES ('$valueId', '${fixture.designSystemId}', '${fixture.tokenId}', '$tenantId', 'web')
                    """.trimIndent(),
                )
                exec(
                    """
                    INSERT INTO token_value_revisions(token_value_id, design_system_id, design_system_version_id,
                        version_sequence_number, value, deleted)
                    VALUES ('$valueId', '${fixture.designSystemId}', '${fixture.draftId}', 1,
                        '{"fontSize":14,"lineHeight":20}'::jsonb, false)
                    """.trimIndent(),
                )
                exec(
                    """
                    INSERT INTO token_value_creation_baselines(design_system_version_id, token_value_id, design_system_id, value)
                    VALUES ('${fixture.draftId}', '$valueId', '${fixture.designSystemId}',
                        '{"fontSize":14,"lineHeight":20}'::jsonb)
                    """.trimIndent(),
                )
            }
            transaction(database) {
                exec("DELETE FROM token_value_revisions WHERE token_value_id = '$valueId'")
                exec(
                    """
                    INSERT INTO token_value_revisions(token_value_id, design_system_id, design_system_version_id,
                        version_sequence_number, value, deleted)
                    VALUES ('$valueId', '${fixture.designSystemId}', '${fixture.draftId}', 1,
                        '{"fontSize":16,"lineHeight":24}'::jsonb, false)
                    """.trimIndent(),
                )
            }
            fun currentChange() = transaction(database) {
                runBlocking { journal.list(ProjectId("project"), false, DesignSystemId(fixture.designSystemId), null) }
                    ?.single { it.entityType == "token-value" }
            }!!
            val change = currentChange()
            transaction(database) {
                assertEquals(
                    DraftChangeRevertResult.Reverted,
                    runBlocking {
                        journal.revert(
                            ProjectId("project"),
                            false,
                            DesignSystemId(fixture.designSystemId),
                            change.changeId,
                            change.editRevision,
                            setOf("/value/fontSize"),
                        )
                    },
                )
            }
            val remaining = currentChange()
            assertEquals(
                Json.parseToJsonElement("""{"fontSize":14,"lineHeight":24}"""),
                remaining.currentValue?.get("value"),
            )
            assertTrue(remaining.editRevision > change.editRevision)
            transaction(database) {
                assertIs<DraftChangeRevertResult.Stale>(
                    runBlocking {
                        journal.revert(
                            ProjectId("project"),
                            false,
                            DesignSystemId(fixture.designSystemId),
                            change.changeId,
                            change.editRevision,
                            setOf("/value/lineHeight"),
                        )
                    },
                )
                assertEquals(
                    DraftChangeRevertResult.InvalidPaths,
                    runBlocking {
                        journal.revert(
                            ProjectId("project"),
                            false,
                            DesignSystemId(fixture.designSystemId),
                            remaining.changeId,
                            remaining.editRevision,
                            setOf("/tenant_id"),
                        )
                    },
                )
                assertEquals(
                    DraftChangeRevertResult.Reverted,
                    runBlocking {
                        journal.revert(
                            ProjectId("project"),
                            false,
                            DesignSystemId(fixture.designSystemId),
                            remaining.changeId,
                            remaining.editRevision,
                            setOf("/value/lineHeight"),
                        )
                    },
                )
            }
            val after = transaction(database) {
                runBlocking { journal.list(ProjectId("project"), false, DesignSystemId(fixture.designSystemId), null) }
            }!!
            assertTrue(after.none { it.entityType == "token-value" })
        }
    }

    @Test
    fun `committed draft mutation publishes one compact invalidation`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            val fixture = connection(postgres).use(::seed)

            connection(postgres).use { listener ->
                listener.autoCommit = true
                listener.createStatement().use { it.execute("LISTEN ds_draft_invalidations") }
                connection(postgres).use { writer ->
                    writer.autoCommit = false
                    writer.createStatement().use { statement ->
                        statement.execute("SELECT set_config('ds.actor_id', 'editor-1', true)")
                        statement.execute("SELECT set_config('ds.client_id', 'tab-1', true)")
                        statement.execute(
                            "INSERT INTO token_revisions(" +
                                "token_id, design_system_id, design_system_version_id, version_sequence_number, " +
                                "name, type, display_name, enabled, deleted" +
                                ") VALUES ('${fixture.tokenId}', '${fixture.designSystemId}', " +
                                "'${fixture.draftId}', 1, 'surface', 'color', 'Surface', true, false)",
                        )
                        statement.execute(
                            "INSERT INTO tenant_revisions(" +
                                "tenant_id, design_system_id, design_system_version_id, " +
                                "version_sequence_number, name, deleted" +
                                ") VALUES ('${fixture.tenantId}', '${fixture.designSystemId}', " +
                                "'${fixture.draftId}', 1, 'Default updated', false)",
                        )
                    }
                    writer.commit()
                }

                val notifications = listener.unwrap(PGConnection::class.java).getNotifications(5_000).orEmpty()
                assertEquals(1, notifications.size)
                val payload = Json.parseToJsonElement(notifications.single().parameter).jsonObject
                assertEquals(
                    fixture.designSystemId.toString(),
                    payload.getValue("designSystemId").jsonPrimitive.content,
                )
                assertEquals(fixture.draftId.toString(), payload.getValue("draftId").jsonPrimitive.content)
                UUID.fromString(payload.getValue("eventId").jsonPrimitive.content)
                assertTrue("draftRevision" !in payload)
                assertEquals("editor-1", payload.getValue("actorId").jsonPrimitive.content)
                assertEquals("tab-1", payload.getValue("clientId").jsonPrimitive.content)
                assertEquals(
                    listOf("theme-tokens", "theme-metadata"),
                    payload.getValue("scopes").jsonArray.map { it.jsonPrimitive.content },
                )
            }
        }
    }

    @Test
    fun `draft theme creation is one journal entry and reverts its initial values atomically`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            val fixture = connection(postgres).use(::seed)
            val database = Database.connect(
                url = postgres.jdbcUrl,
                driver = "org.postgresql.Driver",
                user = postgres.username,
                password = postgres.password,
            )
            val journal = testDraftChangeRepository()
            val tenantId = UUID.randomUUID()
            val valueId = UUID.randomUUID()
            transaction(database) {
                exec("SELECT set_config('ds.actor_id', 'theme-editor', true)")
                exec("INSERT INTO tenants(id, design_system_id) VALUES ('$tenantId', '${fixture.designSystemId}')")
                exec(
                    "INSERT INTO tenant_revisions(" +
                        "tenant_id, design_system_id, design_system_version_id, " +
                        "version_sequence_number, name, deleted" +
                        ") VALUES ('$tenantId', '${fixture.designSystemId}', " +
                        "'${fixture.draftId}', 1, 'New theme', false)",
                )
                exec(
                    "INSERT INTO token_values(id, design_system_id, token_id, tenant_id, platform) VALUES (" +
                        "'$valueId', '${fixture.designSystemId}', '${fixture.tokenId}', '$tenantId', 'web')",
                )
                exec(
                    "INSERT INTO token_value_revisions(" +
                        "token_value_id, design_system_id, design_system_version_id, " +
                        "version_sequence_number, value, deleted" +
                        ") VALUES ('$valueId', '${fixture.designSystemId}', '${fixture.draftId}', 1, " +
                        "'\"#112233\"'::jsonb, false)",
                )
            }

            val changes = transaction(database) {
                runBlocking {
                    journal.list(ProjectId("project"), false, DesignSystemId(fixture.designSystemId), null)
                }
            }!!
            val creation = changes.single()
            assertEquals("tenant", creation.entityType)
            assertEquals(ChangeOperation.CREATED, creation.operation)

            transaction(database) {
                assertEquals(
                    DraftChangeRevertResult.Reverted,
                    runBlocking {
                        journal.revert(
                            ProjectId("project"),
                            false,
                            DesignSystemId(fixture.designSystemId),
                            creation.changeId,
                            creation.editRevision,
                        )
                    },
                )
            }
            connection(postgres).use { connection ->
                assertEquals("0", scalar(connection, "SELECT count(*) FROM tenants WHERE id = '$tenantId'"))
                assertEquals("0", scalar(connection, "SELECT count(*) FROM token_values WHERE id = '$valueId'"))
                assertEquals(
                    "0",
                    scalar(
                        connection,
                        "SELECT count(*) FROM entity_edit_states " +
                            "WHERE design_system_version_id = '${fixture.draftId}' " +
                            "AND entity_id IN ('$tenantId', '$valueId')",
                    ),
                )
            }
        }
    }

    @Test
    fun `edited initial value of a new theme is journaled and reverts to its creation baseline`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            val fixture = connection(postgres).use(::seed)
            val database = Database.connect(
                url = postgres.jdbcUrl,
                driver = "org.postgresql.Driver",
                user = postgres.username,
                password = postgres.password,
            )
            val journal = testDraftChangeRepository()
            val tenantId = UUID.randomUUID()
            val valueId = UUID.randomUUID()
            transaction(database) {
                exec("SELECT set_config('ds.actor_id', 'theme-creator', true)")
                exec("INSERT INTO tenants(id, design_system_id) VALUES ('$tenantId', '${fixture.designSystemId}')")
                exec(
                    "INSERT INTO tenant_revisions(" +
                        "tenant_id, design_system_id, design_system_version_id, " +
                        "version_sequence_number, name, deleted" +
                        ") VALUES ('$tenantId', '${fixture.designSystemId}', " +
                        "'${fixture.draftId}', 1, 'New theme', false)",
                )
                exec(
                    "INSERT INTO token_values(id, design_system_id, token_id, tenant_id, platform) VALUES (" +
                        "'$valueId', '${fixture.designSystemId}', '${fixture.tokenId}', '$tenantId', 'web')",
                )
                exec(
                    "INSERT INTO token_value_revisions(" +
                        "token_value_id, design_system_id, design_system_version_id, " +
                        "version_sequence_number, value, deleted" +
                        ") VALUES ('$valueId', '${fixture.designSystemId}', '${fixture.draftId}', 1, " +
                        "'\"#112233\"'::jsonb, false)",
                )
                exec(
                    "INSERT INTO token_value_creation_baselines(" +
                        "design_system_version_id, token_value_id, design_system_id, value" +
                        ") VALUES ('${fixture.draftId}', '$valueId', '${fixture.designSystemId}', " +
                        "'\"#112233\"'::jsonb)",
                )
            }
            transaction(database) {
                exec("SELECT set_config('ds.actor_id', 'theme-editor', true)")
                exec(
                    "DELETE FROM token_value_revisions " +
                        "WHERE token_value_id = '$valueId' AND design_system_version_id = '${fixture.draftId}'",
                )
                exec(
                    "INSERT INTO token_value_revisions(" +
                        "token_value_id, design_system_id, design_system_version_id, " +
                        "version_sequence_number, value, deleted" +
                        ") VALUES ('$valueId', '${fixture.designSystemId}', '${fixture.draftId}', 1, " +
                        "'\"#445566\"'::jsonb, false)",
                )
            }

            val changes = transaction(database) {
                runBlocking {
                    journal.list(ProjectId("project"), false, DesignSystemId(fixture.designSystemId), null)
                }
            }!!
            val valueChange = changes.single { it.entityType == "token-value" }
            assertEquals(ChangeOperation.UPDATED, valueChange.operation)
            assertEquals(setOf("/value"), valueChange.changedPaths)

            transaction(database) {
                assertEquals(
                    DraftChangeRevertResult.Reverted,
                    runBlocking {
                        journal.revert(
                            ProjectId("project"),
                            false,
                            DesignSystemId(fixture.designSystemId),
                            valueChange.changeId,
                            valueChange.editRevision,
                        )
                    },
                )
            }
            connection(postgres).use { connection ->
                assertEquals(
                    "#112233",
                    scalar(
                        connection,
                        "SELECT value #>> '{}' FROM token_value_revisions " +
                            "WHERE token_value_id = '$valueId' " +
                            "AND design_system_version_id = '${fixture.draftId}'",
                    ),
                )
            }
            val remaining = transaction(database) {
                runBlocking {
                    journal.list(ProjectId("project"), false, DesignSystemId(fixture.designSystemId), null)
                }
            }!!
            assertEquals(listOf("tenant"), remaining.map { it.entityType })
        }
    }

    @Test
    fun `revert of restored token value keeps stable row and published history`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            val fixture = connection(postgres).use(::seed)
            val database = Database.connect(
                url = postgres.jdbcUrl,
                driver = "org.postgresql.Driver",
                user = postgres.username,
                password = postgres.password,
            )
            val journal = testDraftChangeRepository()
            val valueId = fixture.tokenValueId
            transaction(database) {
                exec("SELECT set_config('ds.actor_id', 'restore-editor', true)")
                exec(
                    "INSERT INTO token_value_revisions(" +
                        "token_value_id, design_system_id, design_system_version_id, " +
                        "version_sequence_number, value, deleted" +
                        ") VALUES ('$valueId', '${fixture.designSystemId}', '${fixture.draftId}', 1, " +
                        "'\"restored\"'::jsonb, false)",
                )
            }
            val restoration = transaction(database) {
                runBlocking {
                    journal.list(ProjectId("project"), false, DesignSystemId(fixture.designSystemId), null)
                }
            }!!.single { it.entityType == "token-value" && it.entityId == valueId }
            assertEquals(ChangeOperation.CREATED, restoration.operation)

            transaction(database) {
                assertEquals(
                    DraftChangeRevertResult.Reverted,
                    runBlocking {
                        journal.revert(
                            ProjectId("project"),
                            false,
                            DesignSystemId(fixture.designSystemId),
                            restoration.changeId,
                            restoration.editRevision,
                        )
                    },
                )
            }
            connection(postgres).use { connection ->
                assertEquals("1", scalar(connection, "SELECT count(*) FROM token_values WHERE id = '$valueId'"))
                assertEquals(
                    "1",
                    scalar(
                        connection,
                        "SELECT count(*) FROM token_value_revisions " +
                            "WHERE token_value_id = '$valueId' AND design_system_version_id = '${fixture.baselineId}'",
                    ),
                )
                assertEquals(
                    "0",
                    scalar(
                        connection,
                        "SELECT count(*) FROM token_value_revisions " +
                            "WHERE token_value_id = '$valueId' AND design_system_version_id = '${fixture.draftId}'",
                    ),
                )
            }
        }
    }

    @Test
    fun `concurrent update makes an in-flight revert stale instead of technical failure`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            val fixture = connection(postgres).use(::seed)
            val database = Database.connect(
                url = postgres.jdbcUrl,
                driver = "org.postgresql.Driver",
                user = postgres.username,
                password = postgres.password,
            )
            val journal = testDraftChangeRepository()
            val runner = ExposedTransactionRunner(database, PostgresTransactionFailureMapper())
            transaction(database) {
                exec("SELECT set_config('ds.actor_id', 'first-editor', true)")
                exec(
                    "INSERT INTO token_revisions(" +
                        "token_id, design_system_id, design_system_version_id, version_sequence_number, " +
                        "name, type, enabled, deleted" +
                        ") VALUES ('${fixture.tokenId}', '${fixture.designSystemId}', '${fixture.draftId}', 1, " +
                        "'first-change', 'color', true, false)",
                )
            }
            val change = transaction(database) {
                runBlocking {
                    journal.list(ProjectId("project"), false, DesignSystemId(fixture.designSystemId), null)
                }
            }!!.single { it.entityType == "token" }

            connection(postgres).use { updatingConnection ->
                updatingConnection.autoCommit = false
                updatingConnection.transactionIsolation = Connection.TRANSACTION_SERIALIZABLE
                updatingConnection.createStatement().use { statement ->
                    statement.execute("SELECT set_config('ds.actor_id', 'concurrent-editor', true)")
                    statement.executeQuery(
                        "SELECT revision FROM entity_edit_states " +
                            "WHERE design_system_version_id = '${fixture.draftId}' " +
                            "AND entity_type = 'token' AND entity_id = '${fixture.tokenId}' FOR UPDATE",
                    ).use { rows -> assertTrue(rows.next()) }
                }

                val result = runBlocking {
                    val reverting = async(Dispatchers.IO) {
                        runner.required(context("revert-editor")) {
                            DsResult.Success(
                                journal.revert(
                                    ProjectId("project"),
                                    false,
                                    DesignSystemId(fixture.designSystemId),
                                    change.changeId,
                                    change.editRevision,
                                ),
                            )
                        }
                    }
                    assertTrue(waitForEntityEditStateLock(postgres))
                    updatingConnection.createStatement().use { statement ->
                        statement.execute(
                            "DELETE FROM token_revisions WHERE token_id = '${fixture.tokenId}' " +
                                "AND design_system_version_id = '${fixture.draftId}'",
                        )
                        statement.execute(
                            "INSERT INTO token_revisions(" +
                                "token_id, design_system_id, design_system_version_id, version_sequence_number, " +
                                "name, type, enabled, deleted" +
                                ") VALUES ('${fixture.tokenId}', '${fixture.designSystemId}', " +
                                "'${fixture.draftId}', 1, 'concurrent-change', 'color', true, false)",
                        )
                    }
                    updatingConnection.commit()
                    reverting.await()
                }
                val success = assertIs<DsResult.Success<DraftChangeRevertResult>>(result)
                assertEquals(DraftChangeRevertResult.Stale(change.editRevision + 1), success.value)
            }
        }
    }

    @Test
    fun `journal is computed revert removes draft revision and publication creates empty next draft`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            val fixture = connection(postgres).use(::seed)
            val database = Database.connect(
                url = postgres.jdbcUrl,
                driver = "org.postgresql.Driver",
                user = postgres.username,
                password = postgres.password,
            )
            val journal = testDraftChangeRepository()
            val versions = ExposedDesignSystemVersionRepository(journal)
            val tokens = ExposedTokenRepository()
            val runner = ExposedTransactionRunner(database, PostgresTransactionFailureMapper())

            transaction(database) {
                exec("SELECT set_config('ds.actor_id', 'system-editor', true)")
                exec(
                    "INSERT INTO design_system_revisions(" +
                        "design_system_id, design_system_version_id, version_sequence_number, " +
                        "name, description, deleted" +
                        ") VALUES ('${fixture.designSystemId}', '${fixture.draftId}', 1, " +
                        "'Fixture', 'draft description', false)",
                )
            }
            val designSystemChange = transaction(database) {
                runBlocking {
                    journal.list(ProjectId("project"), false, DesignSystemId(fixture.designSystemId), null)
                }
            }!!.single { it.entityType == "design-system" }
            assertEquals(ChangeOperation.UPDATED, designSystemChange.operation)
            assertEquals(setOf("/description"), designSystemChange.changedPaths)
            transaction(database) {
                assertEquals(
                    DraftChangeRevertResult.Reverted,
                    runBlocking {
                        journal.revert(
                            ProjectId("project"),
                            false,
                            DesignSystemId(fixture.designSystemId),
                            designSystemChange.changeId,
                            designSystemChange.editRevision,
                        )
                    },
                )
            }

            transaction(database) {
                exec("SELECT set_config('ds.actor_id', 'editor-a', true)")
                exec(
                    "INSERT INTO token_revisions(" +
                        "token_id, design_system_id, design_system_version_id, version_sequence_number, " +
                        "name, type, display_name, description, enabled, deleted" +
                        ") VALUES ('${fixture.tokenId}', '${fixture.designSystemId}', '${fixture.draftId}', 1, " +
                        "'surface-updated', 'color', 'Surface', NULL, true, false)",
                )
            }

            val firstChange = transaction(database) {
                runBlocking {
                    journal.list(ProjectId("project"), false, DesignSystemId(fixture.designSystemId), null)
                }
            }!!.single { it.entityType == "token" }
            assertEquals(ChangeOperation.UPDATED, firstChange.operation)
            assertEquals(setOf("/name"), firstChange.changedPaths)
            assertEquals("editor-a", firstChange.actorId)

            transaction(database) {
                exec(
                    "DELETE FROM token_revisions WHERE token_id = '${fixture.tokenId}' " +
                        "AND design_system_version_id = '${fixture.draftId}'",
                )
                exec(
                    "INSERT INTO token_revisions(" +
                        "token_id, design_system_id, design_system_version_id, version_sequence_number, " +
                        "name, type, display_name, description, enabled, deleted" +
                        ") VALUES ('${fixture.tokenId}', '${fixture.designSystemId}', '${fixture.draftId}', 1, " +
                        "'surface-second', 'color', 'Surface', NULL, true, false)",
                )
            }
            transaction(database) {
                val stale = runBlocking {
                    journal.revert(
                        ProjectId("project"),
                        false,
                        DesignSystemId(fixture.designSystemId),
                        firstChange.changeId,
                        firstChange.editRevision,
                    )
                }
                assertEquals(DraftChangeRevertResult.Stale(firstChange.editRevision + 1), stale)
            }
            val currentChange = transaction(database) {
                runBlocking {
                    journal.list(ProjectId("project"), false, DesignSystemId(fixture.designSystemId), null)
                }
            }!!.single { it.entityType == "token" }

            transaction(database) {
                val result = runBlocking {
                    journal.revert(
                        ProjectId("project"),
                        false,
                        DesignSystemId(fixture.designSystemId),
                        currentChange.changeId,
                        currentChange.editRevision,
                    )
                }
                assertEquals(DraftChangeRevertResult.Reverted, result)
            }
            transaction(database) {
                val remaining = runBlocking {
                    journal.list(ProjectId("project"), false, DesignSystemId(fixture.designSystemId), null)
                }
                assertTrue(remaining!!.none { it.entityType == "token" })
            }

            transaction(database) {
                exec("SELECT set_config('ds.actor_id', 'editor-after-revert', true)")
                exec("SELECT set_config('ds.base_revision', '0', true)")
                exec("SELECT set_config('ds.changed_paths', '/name', true)")
                exec("SELECT set_config('ds.mutation_metadata', '[]', true)")
                exec(
                    "INSERT INTO token_revisions(" +
                        "token_id, design_system_id, design_system_version_id, version_sequence_number, " +
                        "name, type, display_name, description, enabled, deleted" +
                        ") VALUES ('${fixture.tokenId}', '${fixture.designSystemId}', '${fixture.draftId}', 1, " +
                        "'surface-after-revert', 'color', 'Surface', NULL, true, false)",
                )
                val metadata = exec("SELECT current_setting('ds.mutation_metadata', true)") { rows ->
                    check(rows.next())
                    rows.getString(1)
                }.orEmpty()
                assertTrue(metadata.contains("\"warnings\": []"), metadata)
            }
            val changeAfterRevert = transaction(database) {
                runBlocking {
                    journal.list(ProjectId("project"), false, DesignSystemId(fixture.designSystemId), null)
                }
            }!!.single { it.entityType == "token" }
            transaction(database) {
                assertEquals(
                    DraftChangeRevertResult.Reverted,
                    runBlocking {
                        journal.revert(
                            ProjectId("project"),
                            false,
                            DesignSystemId(fixture.designSystemId),
                            changeAfterRevert.changeId,
                            changeAfterRevert.editRevision,
                        )
                    },
                )
            }

            transaction(database) {
                exec(
                    "INSERT INTO token_revisions(" +
                        "token_id, design_system_id, design_system_version_id, version_sequence_number, " +
                        "name, type, display_name, description, enabled, deleted" +
                        ") VALUES ('${fixture.tokenId}', '${fixture.designSystemId}', '${fixture.draftId}', 1, " +
                        "'surface', 'color', 'Surface', NULL, true, true)",
                )
            }
            val deletion = transaction(database) {
                runBlocking {
                    journal.list(ProjectId("project"), false, DesignSystemId(fixture.designSystemId), null)
                }
            }!!.single { it.entityType == "token" }
            assertEquals(ChangeOperation.DELETED, deletion.operation)
            transaction(database) {
                assertEquals(
                    DraftChangeRevertResult.Reverted,
                    runBlocking {
                        journal.revert(
                            ProjectId("project"),
                            false,
                            DesignSystemId(fixture.designSystemId),
                            deletion.changeId,
                            deletion.editRevision,
                        )
                    },
                )
            }

            val createdTokenId = UUID.randomUUID()
            val createdValueId = UUID.randomUUID()
            transaction(database) {
                exec(
                    "INSERT INTO tokens(id, design_system_id) VALUES ('$createdTokenId', '${fixture.designSystemId}')",
                )
                exec(
                    "INSERT INTO token_revisions(" +
                        "token_id, design_system_id, design_system_version_id, version_sequence_number, " +
                        "name, type, enabled, deleted" +
                        ") VALUES ('$createdTokenId', '${fixture.designSystemId}', '${fixture.draftId}', 1, " +
                        "'created-in-draft', 'color', true, false)",
                )
                exec(
                    "INSERT INTO token_values(id, design_system_id, token_id, tenant_id) VALUES (" +
                        "'$createdValueId', '${fixture.designSystemId}', '$createdTokenId', '${fixture.tenantId}')",
                )
                exec(
                    "INSERT INTO token_value_revisions(" +
                        "token_value_id, design_system_id, design_system_version_id, version_sequence_number, deleted" +
                        ") VALUES ('$createdValueId', '${fixture.designSystemId}', '${fixture.draftId}', 1, false)",
                )
            }
            val creation = transaction(database) {
                runBlocking {
                    journal.list(ProjectId("project"), false, DesignSystemId(fixture.designSystemId), null)
                }
            }!!.single { it.entityType == "token" && it.entityId == createdTokenId }
            assertEquals(ChangeOperation.CREATED, creation.operation)
            transaction(database) {
                assertEquals(
                    DraftChangeRevertResult.DependencyConflict,
                    runBlocking {
                        journal.revert(
                            ProjectId("project"),
                            false,
                            DesignSystemId(fixture.designSystemId),
                            creation.changeId,
                            creation.editRevision,
                        )
                    },
                )
            }
            transaction(database) {
                exec("DELETE FROM token_value_revisions WHERE token_value_id = '$createdValueId'")
                exec("DELETE FROM token_values WHERE id = '$createdValueId'")
                exec("DELETE FROM token_revisions WHERE token_id = '$createdTokenId'")
                exec("DELETE FROM tokens WHERE id = '$createdTokenId'")
            }

            val aggregateTokenId = UUID.randomUUID()
            val aggregateValueId = UUID.randomUUID()
            transaction(database) {
                exec(
                    "INSERT INTO tokens(id, design_system_id) " +
                        "VALUES ('$aggregateTokenId', '${fixture.designSystemId}')",
                )
                exec(
                    "INSERT INTO token_revisions(" +
                        "token_id, design_system_id, design_system_version_id, version_sequence_number, " +
                        "name, type, enabled, deleted" +
                        ") VALUES ('$aggregateTokenId', '${fixture.designSystemId}', '${fixture.draftId}', 1, " +
                        "'draft-aggregate', 'color', true, false)",
                )
                exec(
                    "INSERT INTO token_values(id, design_system_id, token_id, tenant_id) VALUES (" +
                        "'$aggregateValueId', '${fixture.designSystemId}', '$aggregateTokenId', '${fixture.tenantId}')",
                )
                exec(
                    "INSERT INTO token_value_revisions(" +
                        "token_value_id, design_system_id, design_system_version_id, version_sequence_number, deleted" +
                        ") VALUES ('$aggregateValueId', '${fixture.designSystemId}', '${fixture.draftId}', 1, false)",
                )
                assertTrue(runBlocking { tokens.deleteOwned(ProjectId("project"), aggregateTokenId) })
            }
            connection(postgres).use { connection ->
                assertEquals("0", scalar(connection, "SELECT count(*) FROM tokens WHERE id = '$aggregateTokenId'"))
                assertEquals(
                    "0",
                    scalar(connection, "SELECT count(*) FROM token_values WHERE id = '$aggregateValueId'"),
                )
            }
            transaction(database) {
                val aggregateChanges = runBlocking {
                    journal.list(ProjectId("project"), false, DesignSystemId(fixture.designSystemId), null)
                }
                assertTrue(
                    aggregateChanges!!.none { it.entityId == aggregateTokenId || it.entityId == aggregateValueId },
                )
            }

            transaction(database) {
                exec("SELECT set_config('ds.actor_id', 'editor-b', true)")
                exec(
                    "INSERT INTO token_revisions(" +
                        "token_id, design_system_id, design_system_version_id, version_sequence_number, " +
                        "name, type, display_name, description, enabled, deleted" +
                        ") VALUES ('${fixture.tokenId}', '${fixture.designSystemId}', '${fixture.draftId}', 1, " +
                        "'surface-published', 'color', 'Surface', NULL, true, false)",
                )
            }
            val currentDraftRevision = connection(postgres).use { connection ->
                scalar(
                    connection,
                    "SELECT resolved_draft_revision('${fixture.draftId}')",
                ).toLong()
            }
            val racedPublication = connection(postgres).use { blockingConnection ->
                blockingConnection.autoCommit = false
                blockingConnection.createStatement().use { statement ->
                    statement.executeQuery(
                        "SELECT token_id FROM token_revisions " +
                            "WHERE design_system_version_id = '${fixture.draftId}' " +
                            "AND token_id = '${fixture.tokenId}' FOR UPDATE",
                    ).use { rows -> assertTrue(rows.next()) }
                }
                runBlocking {
                    val boundaryWrite = async(Dispatchers.IO) {
                        runner.required(context("boundary-editor")) {
                            tokens.updateOwned(
                                ProjectId("project"),
                                fixture.tokenId,
                                UpdateToken(
                                    null, false, null, false, null, false, "boundary-write", true, null, false,
                                ),
                            )?.let { DsResult.Success(it) } ?: DsResult.Failure(DsFailure.NotFound)
                        }
                    }
                    assertTrue(waitForTokenRevisionLock(postgres))
                    val publication = async(Dispatchers.IO) {
                        transaction(database) {
                            runBlocking {
                                versions.publish(
                                    ProjectId("project"),
                                    CreateDesignSystemVersion(
                                        DesignSystemId(fixture.designSystemId),
                                        DesignSystemVersionId(fixture.draftId),
                                        currentDraftRevision,
                                        "1.0.0",
                                        "First release",
                                    ),
                                )
                            }
                        }
                    }
                    blockingConnection.commit()
                    assertIs<DsResult.Success<*>>(boundaryWrite.await())
                    publication.await()
                }
            }
            val published = when (racedPublication) {
                is PublishDesignSystemResult.Published -> racedPublication
                is PublishDesignSystemResult.DraftStale -> transaction(database) {
                    runBlocking {
                        versions.publish(
                            ProjectId("project"),
                            CreateDesignSystemVersion(
                                DesignSystemId(fixture.designSystemId),
                                racedPublication.draftId,
                                racedPublication.draftRevision,
                                "1.0.0",
                                "First release",
                            ),
                        )
                    }
                }.let { assertIs<PublishDesignSystemResult.Published>(it) }
                else -> error("Unexpected publication result: $racedPublication")
            }
            assertIs<PublishDesignSystemResult.Published>(published)
            val publishedVersion = published.version
            val publishedChanges = transaction(database) {
                runBlocking {
                    journal.list(
                        ProjectId("project"),
                        false,
                        DesignSystemId(fixture.designSystemId),
                        publishedVersion.id,
                    )
                }
            }
            assertTrue(publishedChanges!!.any { it.entityType == "token" && it.operation == ChangeOperation.UPDATED })
            val boundaryCurrent = transaction(database) {
                runBlocking { tokens.findAccessible(ProjectId("project"), fixture.tokenId) }
            }
            val boundaryHistorical = transaction(database) {
                exec("SELECT set_config('ds.version_id', '${publishedVersion.id.value}', true)")
                runBlocking { tokens.findAccessible(ProjectId("project"), fixture.tokenId) }
            }
            assertEquals("boundary-write", boundaryCurrent?.description)
            if (boundaryHistorical?.description != "boundary-write") {
                val activeChanges = transaction(database) {
                    runBlocking {
                        journal.list(ProjectId("project"), false, DesignSystemId(fixture.designSystemId), null)
                    }
                }
                assertTrue(activeChanges!!.any { it.entityType == "token" && it.entityId == fixture.tokenId })
            }
            connection(postgres).use { connection ->
                assertEquals(
                    "1",
                    scalar(
                        connection,
                        "SELECT count(*) FROM design_system_versions WHERE design_system_id = " +
                            "'${fixture.designSystemId}' AND status = 'draft' AND sequence_number = 2",
                    ),
                )
                assertEquals(
                    if (boundaryHistorical?.description == "boundary-write") "0" else "1",
                    scalar(
                        connection,
                        "SELECT count(*) FROM token_revisions WHERE token_id = '${fixture.tokenId}' " +
                            "AND version_sequence_number = 2",
                    ),
                )
            }
            runBlocking {
                listOf(
                    "editor-name" to UpdateToken(
                        "surface-next", true, null, false, null, false, null, false, null, false,
                    ),
                    "editor-description" to UpdateToken(
                        null, false, null, false, null, false, "parallel-description", true, null, false,
                    ),
                ).map { (actor, command) ->
                    async(Dispatchers.IO) {
                        runner.required(context(actor)) {
                            tokens.updateOwned(ProjectId("project"), fixture.tokenId, command)
                                ?.let { DsResult.Success(it) }
                                ?: DsResult.Failure(DsFailure.NotFound)
                        }
                    }
                }.awaitAll().forEach { assertIs<DsResult.Success<*>>(it) }
            }
            val current = transaction(database) {
                runBlocking { tokens.findAccessible(ProjectId("project"), fixture.tokenId) }
            }
            val historical = transaction(database) {
                exec("SELECT set_config('ds.version_id', '${publishedVersion.id.value}', true)")
                runBlocking { tokens.findAccessible(ProjectId("project"), fixture.tokenId) }
            }
            assertEquals("surface-next", current?.name)
            assertEquals("parallel-description", current?.description)
            assertEquals("surface-published", historical?.name)

            val stalePublication = transaction(database) {
                runBlocking {
                    versions.publish(
                        ProjectId("project"),
                        CreateDesignSystemVersion(
                            DesignSystemId(fixture.designSystemId),
                            DesignSystemVersionId(fixture.draftId),
                            currentDraftRevision,
                            "2.0.0",
                            "Stale request",
                        ),
                    )
                }
            }
            assertIs<PublishDesignSystemResult.DraftStale>(stalePublication)
        }
    }

    private fun seed(connection: Connection): Fixture {
        val fixture = Fixture()
        connection.createStatement().use { statement ->
            statement.execute(
                "INSERT INTO design_systems(id, project_name, project_id) " +
                    "VALUES ('${fixture.designSystemId}', 'fixture', 'project')",
            )
            statement.execute(
                "INSERT INTO design_system_versions(" +
                    "id, design_system_id, status, sequence_number, revision, published_at, created_at" +
                    ") VALUES ('${fixture.baselineId}', '${fixture.designSystemId}', " +
                    "'baseline', 0, 0, NULL, now())",
            )
            statement.execute(
                "INSERT INTO design_system_revisions(" +
                    "design_system_id, design_system_version_id, version_sequence_number, name, deleted" +
                    ") VALUES ('${fixture.designSystemId}', '${fixture.baselineId}', 0, 'Fixture', false)",
            )
            statement.execute(
                "INSERT INTO tokens(id, design_system_id) VALUES ('${fixture.tokenId}', '${fixture.designSystemId}')",
            )
            statement.execute(
                "INSERT INTO tenants(id, design_system_id) VALUES ('${fixture.tenantId}', '${fixture.designSystemId}')",
            )
            statement.execute(
                "INSERT INTO token_values(id, design_system_id, token_id, tenant_id) VALUES (" +
                    "'${fixture.tokenValueId}', '${fixture.designSystemId}', " +
                    "'${fixture.tokenId}', '${fixture.tenantId}')",
            )
            statement.execute(
                "INSERT INTO tenant_revisions(" +
                    "tenant_id, design_system_id, design_system_version_id, version_sequence_number, name, deleted" +
                    ") VALUES ('${fixture.tenantId}', '${fixture.designSystemId}', '${fixture.baselineId}', 0, " +
                    "'Default', false)",
            )
            statement.execute(
                "INSERT INTO token_revisions(" +
                    "token_id, design_system_id, design_system_version_id, version_sequence_number, " +
                    "name, type, display_name, description, enabled, deleted" +
                    ") VALUES ('${fixture.tokenId}', '${fixture.designSystemId}', '${fixture.baselineId}', 0, " +
                    "'surface', 'color', 'Surface', NULL, true, false)",
            )
            statement.execute(
                "INSERT INTO token_value_revisions(" +
                    "token_value_id, design_system_id, design_system_version_id, " +
                    "version_sequence_number, deleted" +
                    ") VALUES ('${fixture.tokenValueId}', '${fixture.designSystemId}', " +
                    "'${fixture.baselineId}', 0, true)",
            )
            statement.execute(
                "INSERT INTO design_system_versions(" +
                    "id, design_system_id, status, sequence_number, revision, published_at, created_at" +
                    ") VALUES ('${fixture.draftId}', '${fixture.designSystemId}', " +
                    "'draft', 1, 0, NULL, now())",
            )
        }
        return fixture
    }

    private fun connection(postgres: IsolatedPostgresDatabase) =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password)

    private suspend fun waitForEntityEditStateLock(postgres: IsolatedPostgresDatabase): Boolean =
        waitForLock(postgres, "entity_edit_states")

    private suspend fun waitForTokenRevisionLock(postgres: IsolatedPostgresDatabase): Boolean =
        waitForLock(postgres, "token_revisions")

    private suspend fun waitForLock(postgres: IsolatedPostgresDatabase, queryFragment: String): Boolean {
        repeat(200) {
            val waiting = connection(postgres).use { connection ->
                connection.prepareStatement(
                    "SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE ?",
                ).use { statement ->
                    statement.setString(1, "%$queryFragment%")
                    statement.executeQuery().use { rows ->
                        check(rows.next())
                        rows.getInt(1)
                    }
                }
            }
            if (waiting > 0) return true
            delay(10)
        }
        return false
    }

    private fun scalar(connection: Connection, sql: String): String = connection.createStatement().use { statement ->
        statement.executeQuery(sql).use { rows ->
            check(rows.next())
            rows.getString(1)
        }
    }

    private fun context(actorId: String) = DsRequestContext(
        ProjectPrincipal(ProjectActorType.USER, actorId, "project", projectRole = "editor"),
        UUID.randomUUID().toString(),
        baseRevision = 0,
    )

    private data class Fixture(
        val designSystemId: UUID = UUID.randomUUID(),
        val baselineId: UUID = UUID.randomUUID(),
        val draftId: UUID = UUID.randomUUID(),
        val tokenId: UUID = UUID.randomUUID(),
        val tenantId: UUID = UUID.randomUUID(),
        val tokenValueId: UUID = UUID.randomUUID(),
    )
}

private fun testDraftChangeRepository() = ExposedDraftChangeRepository(
    listOf(designSystemDraftChangeHandler()) + themeDraftChangeHandlers() + tokenDraftChangeHandlers(),
    listOf(themeDraftChangePolicy()),
)
