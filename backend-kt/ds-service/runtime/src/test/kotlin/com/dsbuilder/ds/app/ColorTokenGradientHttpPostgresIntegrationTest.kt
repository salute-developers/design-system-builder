@file:Suppress("ktlint:standard:max-line-length")

package com.dsbuilder.ds.app

import io.ktor.client.HttpClient
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import java.sql.DriverManager
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Вид значения цветового токена через HTTP на PostgreSQL: тип семейства по значениям всех тем, сплошные значения
 * платформ строкой и слоем при чтении, признак своего значения, журнал без производного типа, откат с пересчётом
 * типа, ссылки на палитру в стопах градиента в текущей и опубликованной версии, связи и удаление растяжки.
 */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class ColorTokenGradientHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = false }

    @Test
    fun `addressed revert serializes with writes creation rename delete and publication`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                for (operation in listOf("write", "create", "rename", "delete", "publish")) {
                    val system = api.create(
                        "/api/design-systems",
                        OWNER,
                        """{"name":"race-$operation","projectName":"race-$operation"}""",
                    )
                    val tenant = api.createTenant(system, "theme")
                    val created = api.call(
                        "POST",
                        "/api/design-systems/$system/tenants/$tenant/color-tokens",
                        MAINTAINER,
                        createBody("brand"),
                    )
                    val token = api.body(created).obj("value").array("members").single().text("tokenId")
                    api.publish(postgres, system, "1.0.0")
                    assertEquals(
                        HttpStatusCode.OK,
                        api.call(
                            "PUT",
                            "/api/design-systems/$system/tenants/$tenant/color-tokens/$token/values",
                            EDITOR,
                            solidBody(token, "#123456"),
                        ).status,
                    )
                    val draft = api.read("/api/design-systems/$system").text("draftId")
                    val changes = api.journal(system)
                    val targets = JsonArray(
                        changes.map { change ->
                            JsonObject(
                                mapOf(
                                    "entityType" to change.getValue("entityType"),
                                    "entityId" to change.getValue("entityId"),
                                    "expectedRevision" to change.getValue("editRevision"),
                                ),
                            )
                        },
                    )
                    val addressBody = """{"draftId":"$draft","targets":$targets}"""
                    val selected = api.values(system, tenant).single {
                        it.text("tokenId") == token && it.text("platform") == "web" && it.text("mode") == "light"
                    }
                    val publicationRevision =
                        text(postgres, "SELECT resolved_draft_revision('$draft')::text", raw = true)
                    val (reverted, concurrent) = kotlinx.coroutines.withTimeout(30_000) {
                        coroutineScope {
                            val revert = async {
                                api.call(
                                    "POST",
                                    "/api/design-systems/$system/changes/revert-by-address",
                                    OWNER,
                                    addressBody,
                                    idempotencyKey = "race-revert-$operation",
                                )
                            }
                            val other = async {
                                when (operation) {
                                    "write" -> api.call(
                                        "PATCH",
                                        "/api/design-systems/$system/token-values/${selected.text("id")}",
                                        EDITOR,
                                        """{"value":["#ABCDEF"]}""",
                                        base = selected.number("editRevision").toLong(),
                                    )
                                    "create" -> api.call(
                                        "POST",
                                        "/api/design-systems/$system/tenants",
                                        EDITOR,
                                        """{"name":"parallel"}""",
                                    )
                                    "rename" -> api.call(
                                        "PATCH",
                                        "/api/design-systems/$system/tokens/$token",
                                        MAINTAINER,
                                        """{"name":"text.default.renamed"}""",
                                    )
                                    "delete" -> api.call("DELETE", "/api/design-systems/$system/tokens/$token", OWNER)
                                    else -> api.call(
                                        "POST",
                                        "/api/design-systems/$system/versions",
                                        OWNER,
                                        """{"draftId":"$draft","draftRevision":$publicationRevision,"version":"1.0.1","changelog":"race"}""",
                                        idempotencyKey = "race-publish",
                                    )
                                }
                            }
                            revert.await() to other.await()
                        }
                    }
                    assertTrue(
                        reverted.status in setOf(HttpStatusCode.OK, HttpStatusCode.Conflict),
                        "$operation revert: ${reverted.status} ${reverted.bodyAsText()}",
                    )
                    assertTrue(
                        concurrent.status in setOf(HttpStatusCode.OK, HttpStatusCode.Created, HttpStatusCode.Conflict),
                        "$operation other: ${concurrent.status} ${concurrent.bodyAsText()}",
                    )
                    assertTrue(reverted.status == HttpStatusCode.OK || concurrent.status != HttpStatusCode.Conflict)
                    if (operation == "publish") {
                        assertTrue(
                            reverted.status != HttpStatusCode.OK || concurrent.status == HttpStatusCode.Conflict,
                            "$operation: ${reverted.status} / ${concurrent.status}",
                        )
                    }
                    if (operation == "write" && concurrent.status == HttpStatusCode.OK) {
                        assertEquals("""["#ABCDEF"]""", text(postgres, storedValueSql(tenant, token, "web", "light")))
                    }
                    if (reverted.status == HttpStatusCode.OK && operation != "delete" &&
                        !(operation == "write" && concurrent.status == HttpStatusCode.OK)
                    ) {
                        assertEquals("""["#FFFFFF"]""", text(postgres, storedValueSql(tenant, token, "web", "light")))
                    }
                    assertEquals(
                        "color",
                        text(
                            postgres,
                            "SELECT type FROM token_revisions WHERE token_id='$token' ORDER BY version_sequence_number DESC LIMIT 1",
                        ),
                    )
                }
            }
        }
    }

    @Test
    fun `literal dependency validation rejects a hidden tenant before reference shortcut`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val system = api.create(
                    "/api/design-systems",
                    OWNER,
                    """{"name":"visibility","projectName":"visibility"}""",
                )
                val tenant = api.createTenant(system, "theme")
                val created = api.call(
                    "POST",
                    "/api/design-systems/$system/tenants/$tenant/color-tokens",
                    MAINTAINER,
                    createBody("brand"),
                )
                val token = api.body(created).obj("value").array("members").single().text("tokenId")
                api.publish(postgres, system, "1.0.0")
                val path = "/api/design-systems/$system/tenants/$tenant/color-tokens/$token/values"
                assertEquals(HttpStatusCode.OK, api.call("PUT", path, EDITOR, solidBody(token, "#123456")).status)
                val change = api.journal(system).first { it.text("entityType") == "token-value" }
                val database = org.jetbrains.exposed.v1.jdbc.Database.connect(
                    postgres.jdbcUrl,
                    user = postgres.username,
                    password = postgres.password,
                )
                fun valid() = org.jetbrains.exposed.v1.jdbc.transactions.transaction(database) {
                    exec("SELECT set_config('ds.design_system_id', '$system', true)")
                    kotlinx.coroutines.runBlocking {
                        com.dsbuilder.ds.themes.data.PaletteRevertDependencyValidator().valid(
                            java.util.UUID.fromString(system),
                            "token-value",
                            java.util.UUID.fromString(change.text("entityId")),
                        )
                    }
                }
                assertTrue(valid())
                val removed = api.call("DELETE", "/api/design-systems/$system/tenants/$tenant", OWNER)
                assertEquals(HttpStatusCode.OK, removed.status, removed.bodyAsText())
                assertFalse(valid())
                val reverted = api.revert(system, change)
                assertEquals(HttpStatusCode.Conflict, reverted.status, reverted.bodyAsText())
            }
        }
    }

    @Test
    fun `literal batch preserves stale errors rollback and replay`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val system = api.create("/api/design-systems", OWNER, """{"name":"batch","projectName":"batch"}""")
                val tenant = api.createTenant(system, "theme")
                val created = api.call(
                    "POST",
                    "/api/design-systems/$system/tenants/$tenant/color-tokens",
                    MAINTAINER,
                    createBody("brand"),
                )
                val token = api.body(created).obj("value").array("members").single().text("tokenId")
                api.publish(postgres, system, "1.0.0")
                val valuePath = "/api/design-systems/$system/tenants/$tenant/color-tokens/$token/values"
                assertEquals(HttpStatusCode.OK, api.call("PUT", valuePath, EDITOR, solidBody(token, "#123456")).status)
                val changes = api.journal(system)
                assertEquals(6, changes.size)
                fun body(stale: Int = -1) = changes.mapIndexed { index, change ->
                    val revision = change.getValue("editRevision").jsonPrimitive.long + if (index == stale) 1 else 0
                    """{"changeId":"${change.text("changeId")}","expectedRevision":$revision}"""
                }.joinToString(",", """{"changes":[""", "]}")
                val path = "/api/design-systems/$system/changes/revert"
                for (index in listOf(0, 2, 5)) {
                    val stale = api.call("POST", path, OWNER, body(index), idempotencyKey = "stale-$index")
                    assertEquals(HttpStatusCode.Conflict, stale.status, stale.bodyAsText())
                    assertEquals("DRAFT_CHANGE_STALE", api.body(stale).text("code"))
                    assertEquals(
                        index.toString(),
                        api.body(stale).obj("details").array("changeIndex").single().jsonPrimitive.content,
                    )
                    assertEquals(6, api.journal(system).size)
                }
                DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                    connection.createStatement().use { statement ->
                        statement.execute(
                            """
                            CREATE FUNCTION fail_batch_constraint() RETURNS trigger LANGUAGE plpgsql AS ${'$'}${'$'}
                            BEGIN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='fixture'; END ${'$'}${'$'};
                            CREATE CONSTRAINT TRIGGER fail_batch AFTER DELETE ON token_value_revisions
                            DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_batch_constraint()
                            """.trimIndent(),
                        )
                    }
                }
                val failed = api.call("POST", path, OWNER, body(), idempotencyKey = "batch-constraint")
                assertEquals(HttpStatusCode.Conflict, failed.status, failed.bodyAsText())
                assertEquals("REVERT_DEPENDENCY_CONFLICT", api.body(failed).text("code"))
                assertEquals(6, api.journal(system).size)
                assertEquals(
                    "0",
                    text(
                        postgres,
                        "SELECT count(*)::text FROM idempotent_requests WHERE idempotency_key='batch-constraint'",
                    ),
                )
                DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                    connection.createStatement().use {
                        it.execute(
                            "DROP TRIGGER fail_batch ON token_value_revisions; DROP FUNCTION fail_batch_constraint()",
                        )
                    }
                }
                val draft = api.read("/api/design-systems/$system").text("draftId")
                val targetPath = "/api/design-systems/$system/changes/token-targets"
                val selector = """{"draftId":"$draft","tenantId":"$tenant","tokenIds":["$token"]}"""
                val scoped = api.call("POST", targetPath, VIEWER, selector)
                assertEquals(HttpStatusCode.OK, scoped.status, scoped.bodyAsText())
                val scopedBody = api.body(scoped).jsonObject
                assertEquals(6, scopedBody.array("targets").size)
                DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                    connection.prepareStatement(
                        """
                        INSERT INTO entity_edit_states(design_system_version_id,design_system_id,entity_type,
                          entity_id,revision,last_actor_id,updated_at)
                        SELECT ?::uuid,?::uuid,'token-value',md5('unrelated-'||i)::uuid,1,'fixture',now()
                        FROM generate_series(1,100001) i
                        """.trimIndent(),
                    ).use { statement ->
                        statement.setString(1, draft)
                        statement.setString(2, system)
                        statement.executeUpdate()
                    }
                }
                val scopedAfter = api.call("POST", targetPath, VIEWER, selector)
                assertEquals(HttpStatusCode.OK, scopedAfter.status, scopedAfter.bodyAsText())
                assertEquals(scopedBody, api.body(scopedAfter).jsonObject)
                val addressPath = "/api/design-systems/$system/changes/revert-by-address"
                val addressBody = """{"draftId":"$draft","targets":${scopedBody.getValue("targets").jsonArray.map {
                    JsonObject(it.jsonObject.filterKeys { key -> key != "operation" })
                }.let(::JsonArray)}}"""
                val addressTargets = json.parseToJsonElement(addressBody).jsonObject.getValue("targets").jsonArray
                val discoveryPayload = JsonArray(
                    addressTargets.map {
                        JsonObject(it.jsonObject + ("operation" to JsonPrimitive("updated")))
                    },
                )
                val invalidBody = api.call(
                    "POST",
                    addressPath,
                    OWNER,
                    """{"draftId":"$draft","targets":$discoveryPayload}""",
                    idempotencyKey = "discovery-is-not-command",
                )
                assertEquals(HttpStatusCode.BadRequest, invalidBody.status)
                assertEquals("INVALID_REVERT_REQUEST", api.body(invalidBody).text("code"))
                for (index in listOf(0, 2, 5)) {
                    val staleTargets = JsonArray(
                        addressTargets.mapIndexed { position, element ->
                            if (position != index) {
                                element
                            } else {
                                JsonObject(
                                    element.jsonObject + (
                                        "expectedRevision" to JsonPrimitive(
                                            element.jsonObject.getValue("expectedRevision").jsonPrimitive.long + 1,
                                        )
                                        ),
                                )
                            }
                        },
                    )
                    val stale = api.call(
                        "POST",
                        addressPath,
                        OWNER,
                        """{"draftId":"$draft","targets":$staleTargets}""",
                        idempotencyKey = "address-stale-$index",
                    )
                    assertEquals(HttpStatusCode.Conflict, stale.status, stale.bodyAsText())
                    assertEquals("DRAFT_CHANGE_STALE", api.body(stale).text("code"))
                    assertEquals(
                        index.toString(),
                        api.body(stale).obj("details").array("changeIndex").single().jsonPrimitive.content,
                    )
                    assertEquals(scopedBody, api.body(api.call("POST", targetPath, VIEWER, selector)).jsonObject)
                }
                DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                    connection.createStatement().use { statement ->
                        statement.execute(
                            """
                            CREATE FUNCTION fail_batch_constraint() RETURNS trigger LANGUAGE plpgsql AS ${'$'}${'$'}
                            BEGIN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='fixture'; END ${'$'}${'$'};
                            CREATE CONSTRAINT TRIGGER fail_batch AFTER DELETE ON token_value_revisions
                            DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_batch_constraint()
                            """.trimIndent(),
                        )
                    }
                }
                val addressFailed = api.call(
                    "POST",
                    addressPath,
                    OWNER,
                    addressBody,
                    idempotencyKey = "address-constraint",
                )
                assertEquals(HttpStatusCode.Conflict, addressFailed.status, addressFailed.bodyAsText())
                assertEquals("REVERT_DEPENDENCY_CONFLICT", api.body(addressFailed).text("code"))
                assertEquals(scopedBody, api.body(api.call("POST", targetPath, VIEWER, selector)).jsonObject)
                assertEquals(
                    "0",
                    text(
                        postgres,
                        "SELECT count(*)::text FROM idempotent_requests WHERE idempotency_key='address-constraint'",
                    ),
                )
                DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                    connection.createStatement().use {
                        it.execute(
                            "DROP TRIGGER fail_batch ON token_value_revisions; DROP FUNCTION fail_batch_constraint()",
                        )
                    }
                }
                val wrongDraft = api.call(
                    "POST",
                    addressPath,
                    OWNER,
                    addressBody.replace(draft, java.util.UUID.randomUUID().toString()),
                    idempotencyKey = "wrong-draft",
                )
                assertEquals(HttpStatusCode.Conflict, wrongDraft.status, wrongDraft.bodyAsText())
                assertEquals("DRAFT_CHANGED", api.body(wrongDraft).text("code"))
                val result = api.call("POST", addressPath, OWNER, addressBody, idempotencyKey = "literal-batch")
                assertEquals(HttpStatusCode.OK, result.status, result.bodyAsText())
                assertTrue(api.journal(system).isEmpty())
                assertEquals("""["#FFFFFF"]""", text(postgres, storedValueSql(tenant, token, "web", "light")))
                val replay = api.call("POST", addressPath, OWNER, addressBody, idempotencyKey = "literal-batch")
                assertEquals(HttpStatusCode.OK, replay.status, replay.bodyAsText())
                assertEquals(result.bodyAsText(), replay.bodyAsText())
                val mismatched = api.call(
                    "POST",
                    addressPath,
                    OWNER,
                    addressBody.replace("\"expectedRevision\":", "\"expectedRevision\":1"),
                    idempotencyKey = "literal-batch",
                )
                assertEquals(HttpStatusCode.Conflict, mismatched.status)
                assertEquals("IDEMPOTENCY_KEY_REUSED", api.body(mismatched).text("code"))

                val currentValues = api.read("/api/design-systems/$system/tenants/$tenant/token-values").array("items")
                val removedValue = value(currentValues, token, "web", "light")
                val deleted = api.call(
                    "DELETE",
                    "/api/design-systems/$system/token-values/${removedValue.text("id")}",
                    OWNER,
                    base = removedValue.number("editRevision").toLong(),
                )
                assertEquals(HttpStatusCode.OK, deleted.status, deleted.bodyAsText())
                val deletedTargets = api.body(
                    api.call("POST", targetPath, VIEWER, selector),
                ).jsonObject.array("targets")
                assertEquals(1, deletedTargets.size)
                assertEquals("deleted", deletedTargets.single().jsonObject.text("operation"))
                val restoreBody = """{"draftId":"$draft","targets":${JsonArray(
                    deletedTargets.map {
                        JsonObject(it.jsonObject.filterKeys { key -> key != "operation" })
                    },
                )}}"""
                assertEquals(
                    HttpStatusCode.OK,
                    api.call(
                        "POST",
                        addressPath,
                        OWNER,
                        restoreBody,
                        idempotencyKey = "restore-deleted",
                    ).status,
                )
                val newTenant = api.createTenant(system, "new-theme")
                val newSelector = selector.replace(tenant, newTenant)
                assertTrue(
                    api.body(api.call("POST", targetPath, VIEWER, newSelector)).jsonObject.array("targets").isEmpty(),
                )
                assertEquals(
                    HttpStatusCode.OK,
                    api.call(
                        "PUT",
                        "/api/design-systems/$system/tenants/$newTenant/color-tokens/$token/values",
                        EDITOR,
                        solidBody(token, "#123456"),
                    ).status,
                )
                val newTargets = api.body(api.call("POST", targetPath, VIEWER, newSelector)).jsonObject.array("targets")
                assertEquals(6, newTargets.size)
                val newBody = """{"draftId":"$draft","targets":${JsonArray(
                    newTargets.map {
                        JsonObject(it.jsonObject.filterKeys { key -> key != "operation" })
                    },
                )}}"""
                assertEquals(
                    HttpStatusCode.OK,
                    api.call(
                        "POST",
                        addressPath,
                        OWNER,
                        newBody,
                        idempotencyKey = "restore-new-theme",
                    ).status,
                )
                assertTrue(
                    api.body(api.call("POST", targetPath, VIEWER, newSelector)).jsonObject.array("targets").isEmpty(),
                )

                DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                    connection.createStatement().use { statement ->
                        statement.execute(
                            """
                            BEGIN;
                            INSERT INTO tokens(id,design_system_id)
                              SELECT md5('page-token-'||i)::uuid,'$system' FROM generate_series(1,101) i;
                            INSERT INTO token_revisions(token_id,design_system_id,design_system_version_id,
                              version_sequence_number,name,type)
                              SELECT md5('page-token-'||i)::uuid,'$system','$draft',b.sequence_number,
                                'text.default.page-'||i,'color' FROM generate_series(1,101) i
                                CROSS JOIN design_system_versions b WHERE b.id='$draft';
                            INSERT INTO token_values(id,design_system_id,token_id,tenant_id,platform,mode)
                              SELECT md5('page-value-'||i)::uuid,'$system',md5('page-token-'||i)::uuid,
                                '$tenant','web','light' FROM generate_series(1,101) i;
                            INSERT INTO token_value_revisions(token_value_id,design_system_id,design_system_version_id,
                              version_sequence_number,value,deleted)
                              SELECT md5('page-value-'||i)::uuid,'$system','$draft',b.sequence_number,
                                '["#FFFFFF"]'::jsonb,false FROM generate_series(1,101) i
                                CROSS JOIN design_system_versions b WHERE b.id='$draft';
                            COMMIT;
                            """.trimIndent(),
                        )
                    }
                }
                val pageIds = (1..101).map { index ->
                    // SQL md5 UUID keeps the digest bits unchanged, unlike UUID.nameUUIDFromBytes.
                    java.security.MessageDigest.getInstance("MD5").digest("page-token-$index".toByteArray())
                        .joinToString("") { "%02x".format(it) }.let { hex ->
                            "${hex.substring(
                                0,
                                8,
                            )}-${hex.substring(
                                8,
                                12,
                            )}-${hex.substring(12,16)}-${hex.substring(16,20)}-${hex.substring(20)}"
                        }
                }
                val pageRequest =
                    JsonObject(
                        mapOf(
                            "draftId" to JsonPrimitive(draft),
                            "tenantId" to JsonPrimitive(tenant),
                            "tokenIds" to JsonArray(pageIds.map(::JsonPrimitive)),
                        ),
                    )
                val firstPage = api.body(api.call("POST", targetPath, VIEWER, pageRequest.toString())).jsonObject
                assertEquals(200, firstPage.array("targets").size)
                val next = JsonObject(pageRequest + ("cursor" to firstPage.getValue("nextCursor")))
                val secondPage = api.body(api.call("POST", targetPath, VIEWER, next.toString())).jsonObject
                assertEquals(2, secondPage.array("targets").size)
                assertEquals(firstPage.text("scopeRevision"), secondPage.text("scopeRevision"))
                assertEquals(
                    HttpStatusCode.OK,
                    api.call(
                        "PATCH",
                        "/api/design-systems/$system/tokens/${pageIds.first()}",
                        EDITOR,
                        """{"description":"changed"}""",
                    ).status,
                )
                val stalePage = api.call("POST", targetPath, VIEWER, next.toString())
                assertEquals(HttpStatusCode.Conflict, stalePage.status, stalePage.bodyAsText())
                assertEquals("TARGET_SNAPSHOT_CHANGED", api.body(stalePage).text("code"))
            }
        }
    }

    @Test
    @Suppress("LongMethod")
    fun `gradient in one mode of one theme derives the family type`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystemId = api.create("/api/design-systems", OWNER, """{"name":"g","projectName":"g"}""")
                val tenantA = api.createTenant(designSystemId, "a")
                val tenantB = api.createTenant(designSystemId, "b")
                val paletteB = api.read("/api/design-systems/$designSystemId/tenants/$tenantB/palette")
                val green = paletteB.array("template")
                    .single { it.text("type") == "general" && it.text("shade") == "green" }
                val greenHex = green.array("steps").single { it.number("step") == STEP }.text("value")
                val created = api.call(
                    "POST",
                    "/api/design-systems/$designSystemId/tenants/$tenantA/color-tokens",
                    MAINTAINER,
                    createBody(),
                )
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                val family = api.body(created).jsonObject.getValue("value").jsonObject
                assertEquals("color", family.text("type"))
                val members = family.array("members").associate { it.text("name") to it.text("tokenId") }
                val base = members.getValue("text.default.highlight")
                val hover = members.getValue("text.default.highlight-hover")
                val valuesPath = "/api/design-systems/$designSystemId/tenants/$tenantB/color-tokens/$base/values"
                // Токен опубликован: дальше журнал показывает только изменения, а не создание.
                api.publish(postgres, designSystemId, "1.0.0")
                val revisionsOfA = count(postgres, valueRevisions(tenantA))

                // Градиент в Dark темы B на всех платформах; Android — своё значение платформы.
                val update = api.call(
                    "PUT",
                    valuesPath,
                    EDITOR,
                    gradientBody(base, api.revisions(designSystemId, tenantB, base)),
                )
                assertEquals(HttpStatusCode.OK, update.status, update.bodyAsText())
                assertEquals("gradient", api.body(update).jsonObject.text("type"))
                val confirmed = api.body(update).jsonObject.getValue("confirmedValues").jsonArray
                assertTrue(confirmed.isNotEmpty())
                assertTrue(confirmed.all { it.jsonObject.text("tenantId") == tenantB })
                assertTrue(confirmed.map { it.jsonObject.text("tokenId") }.toSet() == setOf(base, hover))
                assertTrue(confirmed.all { it.jsonObject.getValue("editRevision").jsonPrimitive.content.toLong() >= 0 })
                assertEquals(0, api.body(update).jsonObject.number("editRevision"))
                val metadata = json.parseToJsonElement(requireNotNull(update.headers["X-DS-Mutation-Metadata"]))
                    .jsonArray
                val definitions = metadata.filter { it.text("entityType") == "token" }.map { it.text("entityId") }
                assertEquals(setOf(base, hover), definitions.toSet())
                assertEquals(6, metadata.count { it.text("entityType") == "token-value" })
                assertEquals(2, count(postgres, typeCount(designSystemId, "gradient")))
                assertEquals(revisionsOfA, count(postgres, valueRevisions(tenantA)), "значения темы A не меняются")

                // Чтение: тема A отдаёт сплошные ios и android слоем color, тема B раскрывает ссылки в градиенте.
                val valuesA = api.values(designSystemId, tenantA)
                val iosA = value(valuesA, base, "ios", "dark")
                assertEquals(layer("#FFFFFF"), iosA.getValue("value"))
                assertEquals(JsonArray(listOf(JsonPrimitive("#FFFFFF"))), iosA.getValue("sourceValue"))
                assertNull(value(valuesA, base, "web", "dark")["sourceValue"])
                val valuesB = api.values(designSystemId, tenantB)
                val webB = value(valuesB, base, "web", "dark")
                val resolvedWeb = webB.getValue("value").toString().uppercase()
                assertTrue(greenHex.uppercase() in resolvedWeb && "[GENERAL" !in resolvedWeb, resolvedWeb)
                assertEquals(gradientWeb(REFERENCE), webB.getValue("sourceValue"))
                assertNull(webB["paletteRef"])
                val androidB = value(valuesB, base, "android", "dark")
                assertEquals(true, androidB.getValue("overridden").jsonPrimitive.boolean)
                assertEquals(false, webB.getValue("overridden").jsonPrimitive.boolean)
                assertTrue(androidB.getValue("value").toString().uppercase().contains(greenHex.uppercase()))
                assertEquals(layer("#000000"), value(valuesB, base, "ios", "light").getValue("value"))

                // Журнал: значения Dark темы B видны, записей о типе определений нет; признак своего значения — путь.
                val journal = api.journal(designSystemId)
                assertTrue(journal.none { it.text("entityType") == "token" })
                val androidChange = journal.single { it.text("entityId") == androidB.text("id") }
                assertTrue("/overridden" in androidChange.array("changedPaths").map { it.jsonPrimitive.content })

                // Изменился только признак — новая редакция с путём /overridden.
                val before = androidB.getValue("editRevision").jsonPrimitive.long
                val flagOnly = api.call(
                    "PUT",
                    valuesPath,
                    EDITOR,
                    """{"editRevision":0,"members":[{"tokenId":"$base","values":[""" +
                        """{"platform":"android","mode":"dark","value":${nativeGradient()},""" +
                        """"baseRevision":$before}]}]}""",
                )
                assertEquals(HttpStatusCode.OK, flagOnly.status, flagOnly.bodyAsText())
                val afterFlag = value(api.values(designSystemId, tenantB), base, "android", "dark")
                assertEquals(false, afterFlag.getValue("overridden").jsonPrimitive.boolean)
                assertTrue(afterFlag.getValue("editRevision").jsonPrimitive.long > before)

                // Пакетная запись не принимает градиент у токена типа color.
                val primary = text(postgres, tokenIdSql(designSystemId, "text.default.primary"))
                val batch = """{"editRevision":0,"values":[{"tokenId":"$primary","platform":"web","mode":"light",""" +
                    """"value":${gradientWeb("#FFFFFF")}}]}"""
                api.reject(
                    "PUT",
                    "/api/design-systems/$designSystemId/tenants/$tenantB/token-values",
                    batch,
                    "INVALID_TOKEN_VALUE",
                )

                // Общий маршрут значения: проверка вида, сплошной слой хранится строкой, тип семейства пересчитывается.
                // Значение без palette_id: у ссылки на общую палитру значение — только прозрачность.
                val accent = text(postgres, tokenIdSql(designSystemId, "surface.default.accent-hover"))
                val accentIos = value(api.values(designSystemId, tenantB), accent, "ios", "dark")
                val accentValue = "/api/design-systems/$designSystemId/token-values/${accentIos.text("id")}"
                api.reject("PATCH", accentValue, """{"value":["not-a-color"]}""", "INVALID_TOKEN_VALUE")
                val solidLayer = api.call("PATCH", accentValue, EDITOR, """{"value":${layer("#123456")}}""")
                assertEquals(HttpStatusCode.OK, solidLayer.status, solidLayer.bodyAsText())
                assertEquals("""["#123456"]""", text(postgres, storedValueSql(tenantB, accent, "ios", "dark")))
                assertEquals(0, count(postgres, accentTypeCount(designSystemId, "gradient")))
                val layered = api.call("PATCH", accentValue, EDITOR, """{"value":${nativeGradient()}}""")
                assertEquals(HttpStatusCode.OK, layered.status, layered.bodyAsText())
                assertEquals(0, count(postgres, accentTypeCount(designSystemId, "color")), "всё семейство — gradient")
                assertTrue(count(postgres, accentTypeCount(designSystemId, "gradient")) > 1)
                // Превью темы берёт цвет только из сплошных значений цветовых токенов и не падает на слоях.
                val preview = api.read("/api/design-systems/$designSystemId/tenants/$tenantB").obj("preview")
                assertTrue(preview.text("accentDark").startsWith("#"), preview.toString())
                val layeredChange = api.journal(designSystemId).single { it.text("entityId") == accentIos.text("id") }
                assertEquals(HttpStatusCode.OK, api.revert(designSystemId, layeredChange).status)
                assertEquals(0, count(postgres, accentTypeCount(designSystemId, "gradient")), "откат вернул color")

                // Откат всех записей темы B: последний градиент уходит, тип возвращается к color.
                while (true) {
                    val change = api.journal(designSystemId)
                        .firstOrNull { it.text("entityType") == "token-value" } ?: break
                    val reverted = api.revert(designSystemId, change)
                    assertEquals(HttpStatusCode.OK, reverted.status, reverted.bodyAsText())
                }
                assertEquals(0, count(postgres, typeCount(designSystemId, "gradient")))
                assertTrue(api.journal(designSystemId).none { it.text("entityType") in setOf("token", "token-value") })

                // Параллельная запись в двух темах: градиент в A и сплошной цвет в B сериализуются по семейству.
                coroutineScope {
                    val pathA = "/api/design-systems/$designSystemId/tenants/$tenantA/color-tokens/$base/values"
                    val inA = async { api.call("PUT", pathA, EDITOR, gradientBody(base, emptyMap())) }
                    val inB = async { api.call("PUT", valuesPath, EDITOR, solidBody(base, "#123456")) }
                    assertEquals(HttpStatusCode.OK, inA.await().status)
                    assertEquals(HttpStatusCode.OK, inB.await().status)
                }
                assertEquals(2, count(postgres, typeCount(designSystemId, "gradient")))

                // Опубликованная версия раскрывает ссылку стопа по палитре своей границы, а черновик — по своей.
                val groupA = api.read("/api/design-systems/$designSystemId/tenants/$tenantA/palette").array("tokens")
                    .single { it.text("tokenId") == base }.text("groupId")
                val step = "/api/design-systems/$designSystemId/tenants/$tenantA/palette/groups/$groupA/ramps/general/green/steps/$STEP"
                val edited = api.call("PATCH", step, EDITOR, """{"value":"#112233","editRevision":0}""")
                assertEquals(HttpStatusCode.OK, edited.status, edited.bodyAsText())
                val publishedId = api.publish(postgres, designSystemId, "1.0.1")
                val reedited = api.call("PATCH", step, EDITOR, """{"value":"#445566","editRevision":0}""")
                assertEquals(HttpStatusCode.OK, reedited.status, reedited.bodyAsText())
                suspend fun webA(version: String?) = value(
                    api.values(designSystemId, tenantA, version),
                    base,
                    "web",
                    "dark",
                ).getValue("value").toString().uppercase()
                assertTrue("#112233" in webA(publishedId), webA(publishedId))
                assertTrue("#445566" in webA(null), webA(null))
                val publishedIos = value(
                    api.values(designSystemId, tenantA, publishedId),
                    hover,
                    "ios",
                    "light",
                )
                assertEquals(layer("#FFFFFF"), publishedIos.getValue("value"), "форма по типу на границе версии")

                // Связь через стоп градиента и удаление растяжки «как Custom» переписывает только ссылки.
                val links = api.read(
                    "/api/design-systems/$designSystemId/tenants/$tenantA/palette/links?type=general&shade=green&groupId=$groupA",
                )
                    .let { JsonArray(it.array("items")) }
                assertTrue(
                    links.any { it.text("tokenId") == base && it.text("mode") == "dark" && it.number("step") == STEP },
                )
                val ramp = "/api/design-systems/$designSystemId/tenants/$tenantA/palette/groups/$groupA/ramps/general/green"
                val removed = api.call("DELETE", ramp, EDITOR, """{"strategy":"detach","editRevision":0}""")
                assertEquals(HttpStatusCode.OK, removed.status, removed.bodyAsText())
                val storedWeb = text(postgres, storedValueSql(tenantA, base, "web", "dark"))
                assertEquals(gradientWeb("#445566").toString(), storedWeb)
                val storedAndroid = text(postgres, storedValueSql(tenantA, base, "android", "dark"))
                assertTrue(
                    "#445566" in storedAndroid && "#FFFFFFFF" in storedAndroid && "[general" !in storedAndroid,
                    storedAndroid,
                )

                // Отмена переписанной ссылки стопа требует вернуть убранную растяжку.
                val rewritten = api.journal(designSystemId).single {
                    it.text("entityType") == "token-value" &&
                        it.obj("currentValue").text("tenant_id") == tenantA &&
                        it.obj("currentValue").text("token_id") == base &&
                        it.obj("currentValue").text("platform") == "web" &&
                        it.obj("currentValue").text("mode") == "dark"
                }
                assertEquals(HttpStatusCode.Conflict, api.revert(designSystemId, rewritten).status)
            }
        }
    }

    @Test
    fun `rename revert keeps the family type derived from values`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystemId = api.create("/api/design-systems", OWNER, """{"name":"r","projectName":"r"}""")
                val tenant = api.createTenant(designSystemId, "a")
                val created = api.call(
                    "POST",
                    "/api/design-systems/$designSystemId/tenants/$tenant/color-tokens",
                    MAINTAINER,
                    createBody("brand"),
                )
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                val tokenId = api.body(created).jsonObject.getValue("value").array("members").single().text("tokenId")
                api.publish(postgres, designSystemId, "1.0.0")

                // В черновике значение стало градиентом, а определение переименовано.
                val values = "/api/design-systems/$designSystemId/tenants/$tenant/color-tokens/$tokenId/values"
                val gradient = api.call("PUT", values, EDITOR, gradientBody(tokenId, emptyMap()))
                assertEquals("gradient", api.body(gradient).jsonObject.text("type"))
                val renamed = api.call(
                    "PATCH",
                    "/api/design-systems/$designSystemId/tokens/$tokenId",
                    EDITOR,
                    """{"name":"text.default.renamed"}""",
                )
                assertEquals(HttpStatusCode.OK, renamed.status, renamed.bodyAsText())
                val change = api.journal(designSystemId).single { it.text("entityType") == "token" }
                assertEquals(listOf("/name"), change.array("changedPaths").map { it.jsonPrimitive.content })

                // Откат переименования возвращает имя, а тип остаётся производным от действующих значений.
                assertEquals(HttpStatusCode.OK, api.revert(designSystemId, change).status)
                val definition = "SELECT name || ':' || type FROM tokens WHERE id = '$tokenId'"
                assertEquals("text.default.brand:gradient", text(postgres, definition))
                assertTrue(api.journal(designSystemId).none { it.text("entityType") == "token" })
            }
        }
    }

    @Test
    @Suppress("LongMethod")
    fun `batch revert resets every entry of a token atomically in one request`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystemId = api.create("/api/design-systems", OWNER, """{"name":"b","projectName":"b"}""")
                val tenant = api.createTenant(designSystemId, "a")
                val created = api.call(
                    "POST",
                    "/api/design-systems/$designSystemId/tenants/$tenant/color-tokens",
                    MAINTAINER,
                    createBody("brand"),
                )
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                val tokenId = api.body(created).jsonObject.getValue("value").array("members").single().text("tokenId")
                api.publish(postgres, designSystemId, "1.0.0")
                val values = "/api/design-systems/$designSystemId/tenants/$tenant/color-tokens/$tokenId/values"
                val gradient = api.call("PUT", values, EDITOR, gradientBody(tokenId, emptyMap()))
                assertEquals("gradient", api.body(gradient).jsonObject.text("type"))
                val renamed = api.call(
                    "PATCH",
                    "/api/design-systems/$designSystemId/tokens/$tokenId",
                    EDITOR,
                    """{"name":"text.default.renamed"}""",
                )
                assertEquals(HttpStatusCode.OK, renamed.status, renamed.bodyAsText())
                val definition = "SELECT name || ':' || type FROM tokens WHERE id = '$tokenId'"
                fun ofToken(change: JsonObject) = change.text("entityId") == tokenId ||
                    change["currentValue"]?.takeIf { it is JsonObject }?.jsonObject?.get("token_id")
                        ?.jsonPrimitive?.content == tokenId
                // Значения раньше определения: их откат пересчитывает тип семейства и сдвигает редакцию определения.
                val entries = api.journal(designSystemId).filter(::ofToken)
                    .sortedBy { if (it.text("entityType") == "token") 1 else 0 }
                assertTrue(entries.size > 1)
                assertEquals("token", entries.last().text("entityType"))
                fun batch(revisionOf: (JsonObject) -> Long) = entries.joinToString(",", """{"changes":[""", "]}") {
                    """{"changeId":"${it.text("changeId")}","expectedRevision":${revisionOf(it)}}"""
                }
                val revisionOf = { change: JsonObject -> change.getValue("editRevision").jsonPrimitive.long }
                val path = "/api/design-systems/$designSystemId/changes/revert"

                // Устаревшая последняя запись: пакет не меняет ничего, отказ называет позицию записи.
                val stale = api.call(
                    "POST",
                    path,
                    OWNER,
                    batch { if (it == entries.last()) revisionOf(it) + 100 else revisionOf(it) },
                    idempotencyKey = "batch-stale",
                )
                assertEquals(HttpStatusCode.Conflict, stale.status, stale.bodyAsText())
                assertEquals("DRAFT_CHANGE_STALE", api.body(stale).text("code"))
                assertEquals(
                    entries.lastIndex,
                    api.body(stale).obj("details").array("changeIndex").single().jsonPrimitive.content.toInt(),
                )
                assertEquals("text.default.renamed:gradient", text(postgres, definition))
                assertEquals(entries.size, api.journal(designSystemId).count(::ofToken))

                val reverted = api.call("POST", path, OWNER, batch(revisionOf), idempotencyKey = "batch-reset")
                assertEquals(HttpStatusCode.OK, reverted.status, reverted.bodyAsText())
                assertEquals("text.default.brand:color", text(postgres, definition))
                assertTrue(api.journal(designSystemId).none(::ofToken))
                val replay = api.call("POST", path, OWNER, batch(revisionOf), idempotencyKey = "batch-reset")
                assertEquals(HttpStatusCode.OK, replay.status, replay.bodyAsText())
                assertEquals(reverted.bodyAsText(), replay.bodyAsText())

                val empty = api.call("POST", path, OWNER, """{"changes":[]}""", idempotencyKey = "batch-empty")
                assertEquals(HttpStatusCode.BadRequest, empty.status, empty.bodyAsText())
                assertEquals("REVERT_BATCH_EMPTY", api.body(empty).text("code"))
                val viewer = api.call("POST", path, VIEWER, batch(revisionOf), idempotencyKey = "batch-viewer")
                assertEquals(HttpStatusCode.Forbidden, viewer.status, viewer.bodyAsText())
            }
        }
    }

    @Test
    fun `definition revert of one member keeps one family type matching values`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystemId = api.create("/api/design-systems", OWNER, """{"name":"m","projectName":"m"}""")
                val tenant = api.createTenant(designSystemId, "a")
                val created = api.call(
                    "POST",
                    "/api/design-systems/$designSystemId/tenants/$tenant/color-tokens",
                    MAINTAINER,
                    createBody(),
                )
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                val members = api.body(created).jsonObject.getValue("value").array("members")
                    .associate { it.text("name") to it.text("tokenId") }
                val base = members.getValue("text.default.highlight")
                val hover = members.getValue("text.default.highlight-hover")
                api.publish(postgres, designSystemId, "1.0.0")

                // Градиент только у `-hover`; у `highlight` — своя правка определения в черновике.
                val values = "/api/design-systems/$designSystemId/tenants/$tenant/color-tokens/$hover/values"
                assertEquals(
                    "gradient",
                    api.body(api.call("PUT", values, EDITOR, gradientBody(hover, emptyMap()))).jsonObject.text("type"),
                )
                val described = api.call(
                    "PATCH",
                    "/api/design-systems/$designSystemId/tokens/$base",
                    EDITOR,
                    """{"description":"described"}""",
                )
                assertEquals(HttpStatusCode.OK, described.status, described.bodyAsText())
                val change = api.journal(designSystemId)
                    .single { it.text("entityType") == "token" && it.text("entityId") == base }

                // Откат возвращает определению `highlight` опубликованный тип color; тип пересчитывается всем членам.
                assertEquals(HttpStatusCode.OK, api.revert(designSystemId, change).status)
                assertEquals(2, count(postgres, typeCount(designSystemId, "gradient")))
                assertEquals(0, count(postgres, typeCount(designSystemId, "color")))
            }
        }
    }

    @Test
    @Suppress("LongMethod")
    fun `removing the theme with the only gradient resets the family type`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystemId = api.create("/api/design-systems", OWNER, """{"name":"d","projectName":"d"}""")
                val tenantA = api.createTenant(designSystemId, "a")
                val tenantC = api.createTenant(designSystemId, "c")
                val created = api.call(
                    "POST",
                    "/api/design-systems/$designSystemId/tenants/$tenantA/color-tokens",
                    MAINTAINER,
                    createBody(),
                )
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                val base = api.body(created).jsonObject.getValue("value").array("members").first().text("tokenId")
                api.publish(postgres, designSystemId, "1.0.0")
                suspend fun gradientIn(tenant: String) = api.call(
                    "PUT",
                    "/api/design-systems/$designSystemId/tenants/$tenant/color-tokens/$base/values",
                    EDITOR,
                    gradientBody(base, emptyMap()),
                ).let { assertEquals("gradient", api.body(it).jsonObject.text("type"), it.bodyAsText()) }

                // Откат создания темы с единственным градиентом: значения темы уходят вместе с ней.
                val tenantD = api.createTenant(designSystemId, "d")
                gradientIn(tenantD)
                assertEquals(2, count(postgres, typeCount(designSystemId, "gradient")))
                val creation = api.journal(designSystemId)
                    .single { it.text("entityType") == "tenant" && it.text("entityId") == tenantD }
                assertEquals(HttpStatusCode.OK, api.revert(designSystemId, creation).status)
                assertEquals(0, count(postgres, typeCount(designSystemId, "gradient")), "откат создания темы")

                // Удаление опубликованной темы с единственным градиентом и откат удаления.
                gradientIn(tenantC)
                val deleted = api.call("DELETE", "/api/design-systems/$designSystemId/tenants/$tenantC", OWNER)
                assertEquals(HttpStatusCode.OK, deleted.status, deleted.bodyAsText())
                assertEquals(0, count(postgres, typeCount(designSystemId, "gradient")), "удаление темы")
                assertTrue(api.journal(designSystemId).none { it.text("entityType") == "token" })
                val deletion = api.journal(designSystemId)
                    .single { it.text("entityType") == "tenant" && it.text("entityId") == tenantC }
                assertEquals(HttpStatusCode.OK, api.revert(designSystemId, deletion).status)
                assertEquals(2, count(postgres, typeCount(designSystemId, "gradient")), "тема и градиент вернулись")
            }
        }
    }

    @Test
    fun `new theme gets initial values of a non-seed gradient token`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystemId = api.create("/api/design-systems", OWNER, """{"name":"n","projectName":"n"}""")
                val tenantA = api.createTenant(designSystemId, "a")
                val created = api.call(
                    "POST",
                    "/api/design-systems/$designSystemId/tenants/$tenantA/color-tokens",
                    MAINTAINER,
                    createBody(),
                )
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                val members = api.body(created).jsonObject.getValue("value").array("members").map { it.text("tokenId") }
                val base = members.first()
                val values = "/api/design-systems/$designSystemId/tenants/$tenantA/color-tokens/$base/values"
                assertEquals(
                    "gradient",
                    api.body(api.call("PUT", values, EDITOR, gradientBody(base, emptyMap()))).jsonObject.text("type"),
                )

                val tenantC = api.createTenant(designSystemId, "c")

                val valuesC = api.values(designSystemId, tenantC)
                members.forEach { member ->
                    val keys = valuesC.filter { it.text("tokenId") == member }
                        .map { it.text("platform") to it.text("mode") }.toSet()
                    assertEquals(PLATFORMS.flatMap { p -> MODES.map { p to it } }.toSet(), keys, member)
                }
                assertEquals(2, count(postgres, typeCount(designSystemId, "gradient")), "тип семейства не меняется")
                // Сплошной цвет новой темы отдаётся по типу семейства: у ios — слоем color.
                val web = value(valuesC, base, "web", "dark").getValue("value").jsonArray.single().jsonPrimitive.content
                assertEquals(layer(web), value(valuesC, base, "ios", "dark").getValue("value"))
            }
        }
    }

    @Test
    @Suppress("LongMethod")
    fun `general token-values routes apply the value kind rule and the published form`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystemId = api.create("/api/design-systems", OWNER, """{"name":"v","projectName":"v"}""")
                val tenantA = api.createTenant(designSystemId, "a")
                val tenantB = api.createTenant(designSystemId, "b")
                val accent = text(postgres, tokenIdSql(designSystemId, "surface.default.accent-hover"))
                val accentIos = value(api.values(designSystemId, tenantB), accent, "ios", "dark")
                val accentValue = "/api/design-systems/$designSystemId/token-values/${accentIos.text("id")}"
                val layered = api.call("PATCH", accentValue, EDITOR, """{"value":${nativeGradient()}}""")
                assertEquals(HttpStatusCode.OK, layered.status, layered.bodyAsText())
                assertEquals(0, count(postgres, accentTypeCount(designSystemId, "color")), "всё семейство — gradient")

                // Общий GET отдаёт ту же форму, что чтение по теме: слой color, раскрытые ссылки, sourceValue/paletteRef.
                val general = JsonArray(
                    api.read("/api/design-systems/$designSystemId/token-values").array("items"),
                ).associateBy {
                    it.text("id")
                }
                listOf(tenantA, tenantB).flatMap { api.values(designSystemId, it) }.forEach { tenantValue ->
                    val id = tenantValue.text("id")
                    val listed = general.getValue(id).jsonObject
                    listOf("value", "paletteRef", "sourceValue").forEach { field ->
                        assertEquals(tenantValue.jsonObject[field], listed[field], "$id $field")
                    }
                    assertEquals(tenantValue.jsonObject["paletteId"], listed["paletteId"], "$id paletteId")
                }
                val solidA = value(api.values(designSystemId, tenantA), accent, "android", "light")
                assertEquals(
                    "color",
                    general.getValue(solidA.text("id")).jsonObject.getValue("value").jsonArray.single()
                        .text("kind"),
                )
                assertTrue(general.values.any { "paletteRef" in it.jsonObject }, "ссылка на всё значение — paletteRef")
                assertTrue(
                    general.values.filter { "paletteRef" in it.jsonObject }.none { "sourceValue" in it.jsonObject },
                    "при paletteRef sourceValue не отдаётся",
                )
                val single = api.read("/api/design-systems/$designSystemId/token-values/${solidA.text("id")}")
                assertEquals(general.getValue(solidA.text("id")).jsonObject.getValue("value"), single.getValue("value"))

                // DELETE единственного градиентного значения возвращает семейству тип color.
                val removed = api.call("DELETE", accentValue, OWNER)
                assertEquals(HttpStatusCode.OK, removed.status, removed.bodyAsText())
                assertEquals(0, count(postgres, accentTypeCount(designSystemId, "gradient")), "удаление вернуло color")

                // POST недопустимого значения: 400 и ничего не создано; слой color хранится строкой.
                fun createBody(tokenId: String, value: String) =
                    """{"tokenId":"$tokenId","tenantId":"$tenantB","platform":"ios","mode":"dark","value":$value}"""
                api.reject(
                    "POST",
                    "/api/design-systems/$designSystemId/token-values",
                    createBody(accent, """["not-a-color"]"""),
                    "INVALID_TOKEN_VALUE",
                )
                assertTrue(
                    api.values(designSystemId, tenantB).none {
                        it.text("tokenId") == accent && it.text("platform") == "ios" && it.text("mode") == "dark"
                    },
                )
                val created = api.call(
                    "POST",
                    "/api/design-systems/$designSystemId/token-values",
                    EDITOR,
                    createBody(accent, layer("#123456").toString()),
                )
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                assertEquals("""["#123456"]""", text(postgres, storedValueSql(tenantB, accent, "ios", "dark")))
                assertEquals(0, count(postgres, accentTypeCount(designSystemId, "gradient")))

                // Токен чужого проекта: 404 до проверки значения, а не 400.
                val foreignOwner = Actor("project-b", "owner")
                val foreign = api.create("/api/design-systems", foreignOwner, """{"name":"f","projectName":"f"}""")
                api.create(
                    "/api/design-systems/$foreign/tenants",
                    Actor("project-b", "editor"),
                    """{"name":"f"}""",
                )
                val foreignAccent = text(postgres, tokenIdSql(foreign, "surface.default.accent-hover"))
                val foreignCreate = api.call(
                    "POST",
                    "/api/design-systems/$designSystemId/token-values",
                    EDITOR,
                    createBody(foreignAccent, """["not-a-color"]"""),
                )
                assertEquals(HttpStatusCode.NotFound, foreignCreate.status, foreignCreate.bodyAsText())
            }
        }
    }

    @Test
    @Suppress("LongMethod")
    fun `general token-values routes initialize the template copy of a theme created outside ds-service`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystemId = api.create("/api/design-systems", OWNER, """{"name":"t","projectName":"t"}""")
                val tenant = api.createTenant(designSystemId, "a")
                val accent = text(postgres, tokenIdSql(designSystemId, "surface.default.accent-hover"))
                val accentBase = text(postgres, tokenIdSql(designSystemId, "surface.default.accent"))
                val values = api.values(designSystemId, tenant)
                val light = value(values, accent, "web", "light")
                val dark = value(values, accent, "web", "dark")
                val reference = """["$REFERENCE"]"""

                // PATCH: тема без копии шаблона получает её до проверки, ссылка на ступень принимается.
                dropTemplate(postgres, tenant)
                val patched = api.call(
                    "PATCH",
                    "/api/design-systems/$designSystemId/token-values/${light.text("id")}",
                    EDITOR,
                    """{"value":$reference}""",
                )
                assertEquals(HttpStatusCode.OK, patched.status, patched.bodyAsText())
                assertTrue(count(postgres, templateCount(tenant)) > 0, "копия шаблона создана")

                // POST: то же для нового значения.
                assertEquals(
                    HttpStatusCode.OK,
                    api.call(
                        "DELETE",
                        "/api/design-systems/$designSystemId/token-values/${dark.text("id")}",
                        OWNER,
                    ).status,
                )
                dropTemplate(postgres, tenant)
                val created = api.call(
                    "POST",
                    "/api/design-systems/$designSystemId/token-values",
                    EDITOR,
                    """{"tokenId":"$accent","tenantId":"$tenant","platform":"web","mode":"dark","value":$reference}""",
                )
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                assertEquals(reference, text(postgres, storedValueSql(tenant, accent, "web", "dark")))

                // PUT …/color-tokens/{id}/values принимает ту же ссылку в теме без копии шаблона.
                dropTemplate(postgres, tenant)
                val put = api.call(
                    "PUT",
                    "/api/design-systems/$designSystemId/tenants/$tenant/color-tokens/$accentBase/values",
                    EDITOR,
                    solidBody(accentBase, REFERENCE),
                )
                assertEquals(HttpStatusCode.OK, put.status, put.bodyAsText())

                // Системный администратор читает общий GET в той же форме: ссылки раскрыты по палитре темы.
                val general = api.call("GET", "/api/design-systems/$designSystemId/token-values", ADMIN)
                assertEquals(HttpStatusCode.OK, general.status, general.bodyAsText())
                val listed = api.body(general).jsonArray.associateBy { it.text("id") }
                val referenced = api.values(designSystemId, tenant).filter { it.jsonObject.containsKey("paletteRef") }
                assertTrue(referenced.any { it.text("id") == light.text("id") }, "ссылка на всё значение")
                referenced.forEach { tenantValue ->
                    val item = listed.getValue(tenantValue.text("id")).jsonObject
                    listOf("value", "paletteRef", "sourceValue", "paletteId").forEach { field ->
                        assertEquals(tenantValue.jsonObject[field], item[field], "${tenantValue.text("id")} $field")
                    }
                }
            }
        }
    }

    @Test
    fun `repeated token-value create replays the stored response and fingerprints the original body`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystemId = api.create("/api/design-systems", OWNER, """{"name":"r","projectName":"r"}""")
                val tenant = api.createTenant(designSystemId, "a")
                val accent = text(postgres, tokenIdSql(designSystemId, "surface.default.accent-hover"))
                val ios = value(api.values(designSystemId, tenant), accent, "ios", "dark")
                assertEquals(
                    HttpStatusCode.OK,
                    api.call(
                        "DELETE",
                        "/api/design-systems/$designSystemId/token-values/${ios.text("id")}",
                        OWNER,
                    ).status,
                )
                fun body(value: String) =
                    """{"tokenId":"$accent","tenantId":"$tenant","platform":"ios","mode":"dark","value":$value}"""
                val layered = body(layer("#123456").toString())

                val created = api.call(
                    "POST",
                    "/api/design-systems/$designSystemId/token-values",
                    EDITOR,
                    layered,
                    idempotencyKey = KEY,
                )
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                assertEquals("""["#123456"]""", text(postgres, storedValueSql(tenant, accent, "ios", "dark")))

                // Другое исходное тело с той же хранимой формой — повторное использование ключа, а не повтор.
                val reused = api.call(
                    "POST",
                    "/api/design-systems/$designSystemId/token-values",
                    EDITOR,
                    body("""["#123456"]"""),
                    idempotencyKey = KEY,
                )
                assertEquals(HttpStatusCode.Conflict, reused.status, reused.bodyAsText())
                assertEquals("IDEMPOTENCY_KEY_REUSED", api.body(reused).text("code"))

                // Повтор успешного запроса после удаления токена возвращает сохранённый ответ 201.
                val deleted = api.call("DELETE", "/api/design-systems/$designSystemId/tokens/$accent", OWNER)
                assertEquals(HttpStatusCode.OK, deleted.status, deleted.bodyAsText())
                val repeated = api.call(
                    "POST",
                    "/api/design-systems/$designSystemId/token-values",
                    EDITOR,
                    layered,
                    idempotencyKey = KEY,
                )
                assertEquals(HttpStatusCode.Created, repeated.status, repeated.bodyAsText())
                assertEquals(api.body(created).text("id"), api.body(repeated).text("id"))
            }
        }
    }

    private inner class Api(private val client: HttpClient) {
        suspend fun call(
            method: String,
            path: String,
            actor: Actor,
            body: String? = null,
            base: Long? = null,
            idempotencyKey: String? = null,
        ) = client.request(path) {
            this.method = HttpMethod.parse(method)
            trusted(actor)
            base?.let { header("X-DS-Base-Revision", it.toString()) }
            idempotencyKey?.let { header("Idempotency-Key", it) }
            body?.let {
                contentType(ContentType.Application.Json)
                setBody(it)
            }
        }

        suspend fun body(response: HttpResponse): JsonElement = json.parseToJsonElement(response.bodyAsText())

        /** Ответ GET; массив оборачивается в объект `{ items }`. */
        suspend fun read(path: String): JsonObject {
            val response = call("GET", path, VIEWER)
            assertEquals(HttpStatusCode.OK, response.status, "$path: ${response.bodyAsText()}")
            return when (val body = body(response)) {
                is JsonArray -> JsonObject(mapOf("items" to body))
                else -> body.jsonObject
            }
        }

        suspend fun create(path: String, actor: Actor, body: String): String {
            val response = call("POST", path, actor, body)
            assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
            return body(response).text("id")
        }

        suspend fun createTenant(designSystemId: String, name: String) =
            create("/api/design-systems/$designSystemId/tenants", EDITOR, """{"name":"$name"}""")

        /** Технические редакции значений токена [tokenId] в теме: `platform:mode` → редакция. */
        suspend fun revisions(designSystemId: String, tenantId: String, tokenId: String): Map<String, Long> =
            read("/api/design-systems/$designSystemId/tenants/$tenantId/token-values").array("items")
                .filter { it.text("tokenId") == tokenId }
                .associate { value ->
                    "${value.text("platform")}:${value.text("mode")}" to
                        value.jsonObject.getValue("editRevision").jsonPrimitive.long
                }

        suspend fun values(designSystemId: String, tenantId: String, version: String? = null): JsonArray =
            JsonArray(
                read(
                    "/api/design-systems/$designSystemId/tenants/$tenantId/token-values" + version?.let { "?versionId=$it" }.orEmpty(),
                )
                    .array("items"),
            )

        suspend fun journal(designSystemId: String) =
            read("/api/design-systems/$designSystemId/changes").array("items").map { it.jsonObject }

        suspend fun revert(designSystemId: String, change: JsonObject) = call(
            "POST",
            "/api/design-systems/$designSystemId/changes/revert-by-address",
            OWNER,
            """{"draftId":"${change.text(
                "versionId",
            )}","targets":[{"entityType":"${change.text(
                "entityType",
            )}","entityId":"${change.text("entityId")}","expectedRevision":${change.getValue("editRevision")}}]}""",
            idempotencyKey = "address-${change.text("changeId")}-${change.getValue("editRevision")}",
        )

        suspend fun publish(postgres: IsolatedPostgresDatabase, designSystemId: String, version: String): String {
            val draftSql = "SELECT id::text || ':' || resolved_draft_revision(id) FROM design_system_versions " +
                "WHERE design_system_id = '$designSystemId' AND status = 'draft'"
            val draft = text(postgres, draftSql, raw = true)
            val (draftId, revision) = draft.split(':')
            val response = call(
                "POST",
                "/api/design-systems/$designSystemId/versions",
                OWNER,
                """{"draftId":"$draftId","draftRevision":$revision,""" +
                    """"version":"$version","changelog":"gradient"}""",
                idempotencyKey = "publish-$designSystemId-$version",
            )
            assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
            return body(response).text("id")
        }

        suspend fun reject(method: String, path: String, body: String, code: String) {
            val response = call(method, path, EDITOR, body)
            assertEquals(HttpStatusCode.BadRequest, response.status, response.bodyAsText())
            assertEquals(code, body(response).text("code"))
        }
    }

    private data class Actor(val projectId: String, val role: String, val systemAdmin: Boolean = false)

    private fun createBody(single: String? = null): String {
        fun member(name: String) = """{"name":"$name","values":[${solidValues("#FFFFFF")}]}"""
        val members = single?.let { member("text.default.$it") }
            ?: "${member("text.default.highlight")},${member("text.default.highlight-hover")}"
        return """{"editRevision":0,"type":"color","group":"text","name":"${single ?: "highlight"}",""" +
            """"members":[$members]}"""
    }

    private fun solidValues(color: String, base: Map<String, Long> = emptyMap()) = PLATFORMS.flatMap { platform ->
        MODES.map { mode -> item(platform, mode, """["$color"]""", base["$platform:$mode"]) }
    }.joinToString(",")

    private fun solidBody(tokenId: String, color: String) =
        """{"editRevision":0,"members":[{"tokenId":"$tokenId","values":[${solidValues(color)}]}]}"""

    /** Light — цвет (iOS слоем color), Dark — градиент со ссылкой в стопе на всех платформах. */
    private fun gradientBody(tokenId: String, base: Map<String, Long>): String {
        val values = listOf(
            item("web", "light", """["#000000"]""", base["web:light"]),
            item("ios", "light", layer("#000000").toString(), base["ios:light"]),
            item("android", "light", """["#000000"]""", base["android:light"]),
            item("web", "dark", gradientWeb(REFERENCE).toString(), base["web:dark"]),
            item("ios", "dark", nativeGradient(), base["ios:dark"]),
            item("android", "dark", nativeGradient(), base["android:dark"], overridden = true),
        )
        return """{"editRevision":0,"members":[{"tokenId":"$tokenId","values":[${values.joinToString(",")}]}]}"""
    }

    private fun item(platform: String, mode: String, value: String, base: Long?, overridden: Boolean = false) =
        """{"platform":"$platform","mode":"$mode","value":$value""" +
            base?.let { ""","baseRevision":$it""" }.orEmpty() + if (overridden) ""","overridden":true}""" else "}"

    private fun gradientWeb(first: String): JsonElement =
        JsonArray(listOf(JsonPrimitive("linear-gradient(90deg, $first 0%, #FFFFFFFF 100%)")))

    private fun nativeGradient() =
        """[{"kind":"linear","locations":[0,1],"colors":["$REFERENCE","#FFFFFFFF"],"angle":90}]"""

    private fun layer(color: String): JsonElement =
        Json.parseToJsonElement("""[{"kind":"color","background":"$color"}]""")

    private fun value(values: JsonArray, tokenId: String, platform: String, mode: String): JsonObject = values.single {
        it.text("tokenId") == tokenId && it.text("platform") == platform && it.text("mode") == mode
    }.jsonObject

    private fun valueRevisions(tenantId: String) =
        "SELECT count(*) FROM token_value_revisions revision JOIN token_values value " +
            "ON value.id = revision.token_value_id WHERE value.tenant_id = '$tenantId'"

    private fun typeCount(designSystemId: String, type: String) =
        "SELECT count(*) FROM tokens WHERE design_system_id = '$designSystemId' AND name LIKE 'text.%.highlight%' " +
            "AND type = '$type'"

    private fun accentTypeCount(designSystemId: String, type: String) =
        "SELECT count(*) FROM tokens WHERE design_system_id = '$designSystemId' " +
            "AND name ~ '^surface\\.[a-z-]+\\.accent(-hover|-active|-brightness)?$' AND type = '$type'"

    private fun tokenIdSql(designSystemId: String, name: String) =
        "SELECT id FROM tokens WHERE design_system_id = '$designSystemId' AND name = '$name'"

    private fun storedValueSql(tenantId: String, tokenId: String, platform: String, mode: String) =
        "SELECT value::text FROM token_values WHERE tenant_id = '$tenantId' AND token_id = '$tokenId' " +
            "AND platform = '$platform' AND mode = '$mode'"

    private fun templateCount(tenantId: String) =
        "SELECT count(*) FROM tenant_palette_template WHERE tenant_id = '$tenantId'"

    /** Убирает копию шаблона палитры темы, как у темы, созданной в обход `ds-service`. */
    private fun dropTemplate(postgres: IsolatedPostgresDatabase, tenantId: String) =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeUpdate("DELETE FROM tenant_palette_template WHERE tenant_id = '$tenantId'")
            }
        }

    private fun count(postgres: IsolatedPostgresDatabase, sql: String): Int = text(postgres, sql).toInt()

    private fun text(postgres: IsolatedPostgresDatabase, sql: String, raw: Boolean = false): String =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery(if (raw) sql else activeRevisionTestSql(sql)).use { rows ->
                    check(rows.next()) { sql }
                    rows.getString(1)
                }
            }
        }

    private fun configuration(postgres: IsolatedPostgresDatabase) = DsServiceConfiguration(
        port = 0,
        databaseUrl = postgres.jdbcUrl,
        databaseUser = postgres.username,
        databasePassword = postgres.password,
        databasePoolSize = 4,
        databaseConnectionTimeoutMs = 5_000,
        authorizationPolicyPath = null,
        runFlyway = true,
        adoptExistingSchema = false,
        expectedSchemaFingerprint = null,
    )

    private fun HttpRequestBuilder.trusted(actor: Actor) {
        header("X-Project-Id", actor.projectId)
        header("X-System-Admin", actor.systemAdmin.toString())
        header("X-Actor-Type", "user")
        header("X-User-Id", "integration-user")
        header("X-Project-Role", actor.role)
    }

    private fun JsonElement.obj(name: String) = jsonObject.getValue(name).jsonObject

    private fun JsonElement.array(name: String) = jsonObject.getValue(name).jsonArray

    private fun JsonElement.text(name: String) = jsonObject.getValue(name).jsonPrimitive.content

    private fun JsonElement.number(name: String) = jsonObject.getValue(name).jsonPrimitive.content.toInt()

    private companion object {
        val OWNER = Actor("project-a", "owner")
        val MAINTAINER = Actor("project-a", "maintainer")
        val EDITOR = Actor("project-a", "editor")
        val VIEWER = Actor("project-a", "viewer")
        val ADMIN = Actor("project-a", "owner", systemAdmin = true)
        const val KEY = "create-ios-dark"
        val PLATFORMS = listOf("web", "ios", "android")
        val MODES = listOf("light", "dark")
        const val STEP = 500
        const val REFERENCE = "[general.green.500]"
    }
}
