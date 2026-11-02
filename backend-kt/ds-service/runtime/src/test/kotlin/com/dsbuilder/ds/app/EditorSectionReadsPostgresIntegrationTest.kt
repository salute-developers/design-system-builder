package com.dsbuilder.ds.app

import io.ktor.client.HttpClient
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/** Срезы разделов возвращают только запрошенные типы выбранной границы и сохраняют права. */
class EditorSectionReadsPostgresIntegrationTest {
    @Test
    fun `tenant value reads filter by section types at draft and published boundaries`() {
        IsolatedPostgresDatabase.create().use { database ->
            testApplication {
                application {
                    module(
                        DsServiceConfiguration(
                            0, database.jdbcUrl, database.username, database.password,
                            4, 5_000, null, true, false, null,
                        ),
                    )
                }
                val system =
                    read(client, "POST", "/api/ds/design-systems", """{"name":"sections","projectName":"sections"}""")
                val systemId = system.field("id")
                val summaryPath = "/api/ds/design-systems/$systemId/changes/summary"
                assertEquals("0", read(client, "GET", summaryPath).field("total"))
                val tenant =
                    read(client, "POST", "/api/ds/tenants", """{"designSystemId":"$systemId","name":"first"}""")
                val tenantId = tenant.field("id")
                val markersPath = "/api/ds/design-systems/$systemId/changes/token-ids?tenantId=$tenantId"
                val markers = api(client, "GET", markersPath)
                assertEquals(HttpStatusCode.OK, markers.status)
                assertNotNull(markers.headers["X-DS-Read-Context"])
                val ids = Json.parseToJsonElement(markers.bodyAsText()).jsonObject.getValue("tokenIds").jsonArray
                assertEquals(ids.size, ids.toSet().size)
                assertEquals(HttpStatusCode.BadRequest, api(client, "GET", "$markersPath&version=bad").status)
                val conflict = "$markersPath&version=draft&versionId=${UUID.randomUUID()}"
                assertEquals(HttpStatusCode.BadRequest, api(client, "GET", conflict).status)
                assertEquals(HttpStatusCode.BadRequest, api(client, "GET", markersPath.substringBefore('?')).status)
                assertEquals(HttpStatusCode.Forbidden, api(client, "GET", markersPath, role = "none").status)
                assertEquals(HttpStatusCode.NotFound, api(client, "GET", markersPath, project = "other").status)
                val summary = read(client, "GET", summaryPath)
                assertEquals(setOf("total"), summary.jsonObject.keys)
                assertEquals("1", summary.field("total"))
                assertEquals(HttpStatusCode.NotFound, api(client, "GET", summaryPath, project = "other").status)
                val definitions = read(client, "GET", "/api/ds/design-systems/$systemId/tokens").jsonArray
                val colorIds = definitions.filter { it.field("type") == "color" }.map { it.field("id") }.toSet()
                val filteredDefinitions = read(client, "GET", "/api/ds/design-systems/$systemId/tokens?type=color")
                    .jsonArray
                assertEquals(colorIds, filteredDefinitions.map { it.field("id") }.toSet())
                assertEquals(
                    definitions.filter { it.field("type") == "gradient" }.map { it.field("id") }.toSet(),
                    read(client, "GET", "/api/ds/design-systems/$systemId/tokens?type=gradient")
                        .jsonArray.map { it.field("id") }.toSet(),
                )
                val sizeIds = definitions.filter { it.field("type") in setOf("shape", "spacing", "shadow") }
                    .map { it.field("id") }.toSet()
                val path = "/api/ds/tenants/$tenantId/token-values"
                val colors = read(client, "GET", "$path?types=color").jsonArray
                val sizes = read(client, "GET", "$path?types=shape,spacing,shadow").jsonArray
                assertTrue(colors.isNotEmpty())
                assertTrue(sizes.isNotEmpty())
                assertTrue(colors.all { it.field("tokenId") in colorIds })
                assertTrue(sizes.all { it.field("tokenId") in sizeIds })
                val full = read(client, "GET", path).jsonArray
                assertTrue(full.size > colors.size)
                val cursor = read(client, "GET", "/api/ds/design-systems/$systemId")
                val version = read(
                    client,
                    "POST",
                    "/api/ds/design-system-versions",
                    """{"designSystemId":"$systemId","draftId":"${cursor.field(
                        "draftId",
                    )}","draftRevision":${cursor.field("draftRevision")},"version":"1.0.0"}""",
                ).field("id")
                assertEquals(
                    sizes.associateBy { it.field("id") },
                    read(client, "GET", "$path?types=shape,spacing,shadow&versionId=$version")
                        .jsonArray.associateBy { it.field("id") },
                )
                assertEquals(
                    colorIds,
                    read(client, "GET", "/api/ds/design-systems/$systemId/tokens?type=color&versionId=$version")
                        .jsonArray.map { it.field("id") }.toSet(),
                )
                assertEquals(
                    read(client, "GET", "$markersPath&versionId=$version"),
                    read(client, "GET", "$markersPath&version=1.0.0"),
                )
                for (filter in listOf("unknown", "color,", "")) {
                    assertEquals(HttpStatusCode.BadRequest, api(client, "GET", "$path?types=$filter").status)
                }
                assertEquals(HttpStatusCode.Forbidden, api(client, "GET", "$path?types=color", role = "none").status)
                assertEquals(HttpStatusCode.NotFound, api(client, "GET", "$path?types=color", project = "other").status)
            }
        }
    }

    private suspend fun read(client: HttpClient, method: String, path: String, body: String? = null): JsonElement {
        val response = api(client, method, path, body)
        assertTrue(response.status.value in 200..299, response.bodyAsText())
        return Json.parseToJsonElement(response.bodyAsText())
    }

    private suspend fun api(
        client: HttpClient,
        method: String,
        path: String,
        body: String? = null,
        project: String = "section-project",
        role: String = "owner",
    ) = client.request(path) {
        this.method = HttpMethod.parse(method)
        header("X-Actor-Type", "user")
        header("X-User-Id", "section-user")
        header("X-Project-Id", project)
        header("X-Project-Role", role)
        header("X-DS-Base-Revision", "0")
        header("Idempotency-Key", UUID.randomUUID().toString())
        if (body != null) {
            contentType(ContentType.Application.Json)
            setBody(body)
        }
    }

    private fun JsonElement.field(name: String) = jsonObject.getValue(name).jsonPrimitive.content
}
