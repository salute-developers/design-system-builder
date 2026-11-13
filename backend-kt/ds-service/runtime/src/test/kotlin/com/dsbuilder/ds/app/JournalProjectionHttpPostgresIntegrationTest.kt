package com.dsbuilder.ds.app

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.data.ExposedDraftChangeRepository
import com.dsbuilder.ds.designsystems.data.designSystemDraftChangeHandler
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.themes.data.themeDraftChangeHandlers
import com.dsbuilder.ds.themes.data.themeDraftChangePolicy
import com.dsbuilder.ds.tokens.data.tokenDraftChangeHandlers
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

/** HTTP остаётся эквивалентен прежнему читателю при нуле, одной и девяти правках. */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class JournalProjectionHttpPostgresIntegrationTest {
    @Test
    fun `compact HTTP matches legacy across new and published themes and keeps access checks`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            val db = Database.connect(postgres.jdbcUrl, user = postgres.username, password = postgres.password)
            val legacy = ExposedDraftChangeRepository(
                listOf(designSystemDraftChangeHandler()) + themeDraftChangeHandlers() + tokenDraftChangeHandlers(),
                listOf(themeDraftChangePolicy()),
            )
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
                        val expected = transaction(db = db) {
                            runBlocking {
                                legacy.summary(ProjectId("performance-project"), false, DesignSystemId(owner), null) to
                                    legacy.changedTokenIds(
                                        ProjectId("performance-project"),
                                        false,
                                        DesignSystemId(owner),
                                        null,
                                        tenant,
                                    )
                            }
                        }
                        val summary = api.get(summaryPath).jsonObject
                        assertEquals(setOf("total"), summary.keys)
                        assertEquals(expected.first.toString(), summary.getValue("total").jsonPrimitive.content)
                        val marks = api.get(marksPath).jsonObject.getValue("tokenIds").jsonArray
                            .map { UUID.fromString(it.jsonPrimitive.content) }.toSet()
                        assertEquals(expected.second, marks)
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
}
