package com.dsbuilder.ds.app

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.data.ExposedDraftChangeRepository
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.koin.ktor.ext.getKoin
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/** HTTP остаётся эквивалентен прежнему читателю при нуле, одной и девяти правках. */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class JournalProjectionHttpPostgresIntegrationTest {
    @Test
    fun `compact HTTP matches legacy across new and published themes and keeps access checks`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            val db = Database.connect(postgres.jdbcUrl, user = postgres.username, password = postgres.password)
            lateinit var legacy: ExposedDraftChangeRepository
            testApplication {
                application {
                    module(
                        DsServiceConfiguration(
                            0,
                            postgres.jdbcUrl,
                            postgres.username,
                            postgres.password,
                            4,
                            5_000,
                            null,
                            false,
                            false,
                            null,
                        ),
                    )
                    legacy = ExposedDraftChangeRepository(getKoin().getAll(), getKoin().getAll())
                }
                val api = JournalHttpFixture(client)
                val fixture = api.seed(0)
                for ((_, item) in fixture) {
                    val owner = UUID.fromString(item.jsonObject.getValue("system").jsonPrimitive.content)
                    val tenant = UUID.fromString(item.jsonObject.getValue("tenant").jsonPrimitive.content)
                    val root = "/api/design-systems/$owner"
                    val summaryPath = "$root/changes/summary"
                    val marksPath = "$root/changes/token-ids?tenantId=$tenant"
                    val values = api.get("$root/tenants/$tenant/token-values?types=color").jsonArray.take(9)
                    val initialSummary = api.get(summaryPath)
                    val initialMarks = api.get(marksPath)
                    val version = item.jsonObject["versionId"]?.jsonPrimitive?.content
                    val historicalSummary = version?.let { api.get("$summaryPath?versionId=$it") }
                    val historicalMarks = version?.let { api.get("$marksPath&versionId=$it") }
                    var applied = 0
                    for (count in listOf(0, 1, 9)) {
                        for (value in values.drop(applied).take(count - applied)) {
                            val id = value.jsonObject.getValue("id").jsonPrimitive.content
                            api.call("PATCH", "$root/token-values/$id", """{"value":["#123456"]}""")
                        }
                        applied = count
                        assertEquivalent(api, db, legacy, owner, tenant)
                    }
                    val rows = api.get("$root/changes").jsonArray
                        .map { it.jsonObject }
                        .filter { it.getValue("entityType").jsonPrimitive.content == "token-value" }
                    val targets = JsonArray(
                        rows.map { row ->
                            JsonObject(
                                mapOf(
                                    "entityType" to row.getValue("entityType"),
                                    "entityId" to row.getValue("entityId"),
                                    "expectedRevision" to row.getValue("editRevision"),
                                ),
                            )
                        },
                    )
                    val draft = api.get(root).jsonObject.getValue("draftId")
                    api.call("POST", "$root/changes/revert-by-address", """{"draftId":$draft,"targets":$targets}""")
                    assertEquals(initialSummary, api.get(summaryPath))
                    assertEquals(initialMarks, api.get(marksPath))
                    val token = values.first().jsonObject.getValue("tokenId").jsonPrimitive.content
                    val gradient = "linear-gradient(90deg, #123456 0%, #FFFFFF 100%)"
                    api.call(
                        "PUT",
                        "$root/tenants/$tenant/color-tokens/$token/values",
                        """{"editRevision":0,"members":[{"tokenId":"$token","values":[
                            {"platform":"web","mode":"dark","value":["$gradient"]}]}]}""",
                    )
                    assertEquals(
                        "gradient",
                        api.get("$root/tokens/$token").jsonObject.getValue("type").jsonPrimitive.content,
                    )
                    assertEquivalent(api, db, legacy, owner, tenant)
                    api.call(
                        "PATCH",
                        "$root/tokens/$token",
                        """{"displayName":"Changed","description":"Journal test"}""",
                    )
                    assertEquivalent(api, db, legacy, owner, tenant)
                    val valueId = values.first().jsonObject.getValue("id").jsonPrimitive.content
                    api.call("DELETE", "$root/token-values/$valueId")
                    assertEquivalent(api, db, legacy, owner, tenant)
                    val component = client.post("/api/design-systems/catalog/components") {
                        header("X-Actor-Type", "user")
                        header("X-User-Id", "journal-admin")
                        header("X-Project-Id", "global")
                        header("X-System-Admin", "true")
                        contentType(ContentType.Application.Json)
                        setBody("""{"name":"Journal $owner","platform":"web"}""")
                    }
                    assertEquals(HttpStatusCode.Created, component.status)
                    val componentId = Json.parseToJsonElement(component.bodyAsText()).jsonObject.getValue("id")
                    api.call("POST", "$root/design-system-components", """{"componentId":$componentId}""")
                    assertEquivalent(api, db, legacy, owner, tenant)
                    val foreignTenant = fixture.values.map { it.jsonObject }.first {
                        it.getValue("system").jsonPrimitive.content != owner.toString()
                    }.getValue("tenant").jsonPrimitive.content
                    assertEquals(
                        HttpStatusCode.NotFound,
                        api.request("GET", "$root/changes/token-ids?tenantId=$foreignTenant").status,
                    )

                    for (path in listOf(summaryPath, marksPath)) {
                        assertNotNull(api.request("GET", path).headers["X-DS-Read-Context"])
                        assertEquals(HttpStatusCode.Forbidden, api.request("GET", path, role = "none").status)
                        assertEquals(HttpStatusCode.NotFound, api.request("GET", path, project = "other").status)
                    }
                    assertEquals(
                        HttpStatusCode.NotFound,
                        api.request(
                            "GET",
                            "$root/changes/token-ids?tenantId=${UUID.randomUUID()}",
                        ).status,
                    )
                    if (version != null) {
                        assertEquals(historicalSummary, api.get("$summaryPath?versionId=$version"))
                        assertEquals(historicalMarks, api.get("$marksPath&versionId=$version"))
                    }
                }
            }
        }
    }

    @Test
    fun `compact HTTP remains exact when full journal exceeds its limit`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            val db = Database.connect(postgres.jdbcUrl, user = postgres.username, password = postgres.password)
            val fixture = transaction(db = db) {
                JournalProjectionSqlFixture(10001).also { f ->
                    exec(
                        """
                        INSERT INTO token_revisions(token_id,design_system_id,design_system_version_id,
                            version_sequence_number,name,type,display_name)
                        SELECT token_id,design_system_id,'${f.draft}',1,name,type,'Changed'
                        FROM token_revisions WHERE design_system_id='${f.owner}'
                        """.trimIndent(),
                    )
                    exec("ANALYZE")
                }
            }
            testApplication {
                application {
                    module(
                        DsServiceConfiguration(
                            0, postgres.jdbcUrl, postgres.username, postgres.password,
                            4, 5_000, null, false, false, null,
                        ),
                    )
                }
                val api = JournalHttpFixture(client, "project")
                val root = "/api/design-systems/${fixture.owner}/changes"
                val full = api.request("GET", root)
                assertEquals(HttpStatusCode.UnprocessableEntity, full.status)
                assertTrue(full.bodyAsText().contains("JOURNAL_LIMIT_EXCEEDED"))
                val summary = api.request("GET", "$root/summary")
                assertEquals(HttpStatusCode.OK, summary.status)
                assertNotNull(summary.headers["X-DS-Read-Context"])
                assertEquals(
                    "10002",
                    Json.parseToJsonElement(summary.bodyAsText())
                        .jsonObject.getValue("total").jsonPrimitive.content,
                )
                val marks = api.request("GET", "$root/token-ids?tenantId=${fixture.newTenant}")
                assertEquals(HttpStatusCode.OK, marks.status)
                assertNotNull(marks.headers["X-DS-Read-Context"])
                val ids = Json.parseToJsonElement(marks.bodyAsText()).jsonObject.getValue("tokenIds").jsonArray
                assertEquals(10001, ids.size)
                assertEquals(ids.size, ids.toSet().size)
            }
        }
    }

    private suspend fun assertEquivalent(
        api: JournalHttpFixture,
        db: Database,
        legacy: ExposedDraftChangeRepository,
        owner: UUID,
        tenant: UUID,
    ) {
        val expected = transaction(db = db) {
            runBlocking {
                legacy.summary(ProjectId("performance-project"), false, DesignSystemId(owner), null) to
                    legacy.changedTokenIds(ProjectId("performance-project"), false, DesignSystemId(owner), null, tenant)
            }
        }
        val root = "/api/design-systems/$owner/changes"
        val summary = api.get("$root/summary").jsonObject
        assertEquals(setOf("total"), summary.keys)
        assertEquals(expected.first.toString(), summary.getValue("total").jsonPrimitive.content)
        val marks = api.get("$root/token-ids?tenantId=$tenant").jsonObject.getValue("tokenIds").jsonArray
            .map { UUID.fromString(it.jsonPrimitive.content) }.toSet()
        assertEquals(expected.second, marks)
        val full = api.request("GET", root)
        assertEquals(HttpStatusCode.OK, full.status)
        assertEquals(expected.first.toString(), full.headers["X-DS-Journal-Total"])
    }
}
