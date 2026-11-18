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
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/** Срезы разделов возвращают только запрошенные типы выбранной границы и сохраняют права. */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class EditorSectionReadsPostgresIntegrationTest {
    @Test
    fun `tenant value reads filter by section types at draft and published boundaries`() {
        IsolatedPostgresDatabase.create().use { database ->
            val role = "reader_${UUID.randomUUID().toString().replace("-", "")}"
            DriverManager.getConnection(database.jdbcUrl, database.username, database.password).use { connection ->
                connection.createStatement().use { statement ->
                    statement.execute("CREATE ROLE $role LOGIN PASSWORD 'isolated-test' NOSUPERUSER NOBYPASSRLS")
                    statement.execute("GRANT USAGE ON SCHEMA public TO $role")
                    statement.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO $role")
                    statement.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO $role")
                    statement.executeQuery(
                        "SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relrowsecurity",
                    ).use {
                        check(it.next())
                        println(
                            "public tables with RLS enabled: ${it.getInt(
                                1,
                            )}; application role has no superuser/BYPASSRLS",
                        )
                    }
                }
            }
            DriverManager.getConnection(database.jdbcUrl, role, "isolated-test").use { connection ->
                connection.createStatement().use { statement ->
                    statement.executeQuery(
                        "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user",
                    ).use {
                        check(it.next())
                        assertEquals(false, it.getBoolean(1))
                        assertEquals(false, it.getBoolean(2))
                    }
                }
            }
            testApplication {
                application {
                    module(
                        DsServiceConfiguration(
                            0, database.jdbcUrl, role, "isolated-test",
                            4, 5_000, null, false, false, null,
                        ),
                    )
                }
                val system =
                    read(client, "POST", "/api/design-systems", """{"name":"sections","projectName":"sections"}""")
                val systemId = system.field("id")
                val summaryPath = "/api/design-systems/$systemId/changes/summary"
                assertEquals("0", read(client, "GET", summaryPath).field("total"))
                val tenant =
                    read(client, "POST", "/api/design-systems/$systemId/tenants", """{"name":"first"}""")
                val tenantId = tenant.field("id")
                val markersPath = "/api/design-systems/$systemId/changes/token-ids?tenantId=$tenantId"
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
                val definitions = read(client, "GET", "/api/design-systems/$systemId/tokens").jsonArray
                val colorIds = definitions.filter { it.field("type") == "color" }.map { it.field("id") }.toSet()
                val filteredDefinitions = read(client, "GET", "/api/design-systems/$systemId/tokens?type=color")
                    .jsonArray
                assertEquals(colorIds, filteredDefinitions.map { it.field("id") }.toSet())
                assertEquals(
                    definitions.filter { it.field("type") == "gradient" }.map { it.field("id") }.toSet(),
                    read(client, "GET", "/api/design-systems/$systemId/tokens?type=gradient")
                        .jsonArray.map { it.field("id") }.toSet(),
                )
                val sizeIds = definitions.filter { it.field("type") in setOf("shape", "spacing", "shadow") }
                    .map { it.field("id") }.toSet()
                val path = "/api/design-systems/$systemId/tenants/$tenantId/token-values"
                val firstColor = read(client, "GET", "$path?types=color").jsonArray.first()
                read(
                    client,
                    "PATCH",
                    "/api/design-systems/$systemId/token-values/${firstColor.field("id")}",
                    """{"value":["#123456"]}""",
                )
                val colors = read(client, "GET", "$path?types=color").jsonArray
                assertTrue(colors.any { it.field("editRevision").toLong() > 0 })
                val sizes = read(client, "GET", "$path?types=shape,spacing,shadow").jsonArray
                assertTrue(colors.isNotEmpty())
                assertTrue(sizes.isNotEmpty())
                assertTrue(colors.all { it.field("tokenId") in colorIds })
                val selectedToken = colorIds.first()
                assertEquals(
                    colors.filter { it.field("tokenId") == selectedToken }.toSet(),
                    read(client, "GET", "$path?types=color&tokenIds=$selectedToken").jsonArray.toSet(),
                )
                assertEquals(
                    setOf(selectedToken),
                    read(client, "GET", "/api/design-systems/$systemId/tokens?tokenIds=$selectedToken")
                        .jsonArray.map { it.field("id") }.toSet(),
                )
                for (filter in listOf("", "bad", "$selectedToken,", "$selectedToken&tokenIds=$selectedToken")) {
                    assertEquals(HttpStatusCode.BadRequest, api(client, "GET", "$path?tokenIds=$filter").status)
                    assertEquals(
                        HttpStatusCode.BadRequest,
                        api(client, "GET", "/api/design-systems/$systemId/tokens?tokenIds=$filter").status,
                    )
                }
                assertEquals(0, read(client, "GET", "$path?tokenIds=${UUID.randomUUID()}").jsonArray.size)
                assertTrue(sizes.all { it.field("tokenId") in sizeIds })
                val full = read(client, "GET", path).jsonArray
                assertTrue(full.size > colors.size)
                val mobile = read(client, "GET", "$path?types=color&platforms=ios,web").jsonArray
                assertEquals(setOf("ios", "web"), mobile.map { it.field("platform") }.toSet())
                assertEquals(colors.count { it.field("platform") != "android" }, mobile.size)
                for (filter in listOf("windows", "ios,", "ios,ios", "")) {
                    val status = api(client, "GET", "$path?types=color&platforms=$filter").status
                    assertEquals(HttpStatusCode.BadRequest, status, filter)
                }
                val cursor = read(client, "GET", "/api/design-systems/$systemId")
                val version = read(
                    client,
                    "POST",
                    "/api/design-systems/$systemId/versions",
                    """{"draftId":"${cursor.field(
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
                    read(client, "GET", "/api/design-systems/$systemId/tokens?type=color&versionId=$version")
                        .jsonArray.map { it.field("id") }.toSet(),
                )
                assertEquals(
                    colors.filter { it.field("tokenId") == selectedToken }.toSet(),
                    read(client, "GET", "$path?tokenIds=$selectedToken&versionId=$version").jsonArray.toSet(),
                )
                assertEquals(
                    read(client, "GET", "$markersPath&versionId=$version"),
                    read(client, "GET", "$markersPath&version=1.0.0"),
                )
                val deletedId = firstColor.field("id")
                val deletion = api(client, "DELETE", "/api/design-systems/$systemId/token-values/$deletedId")
                assertEquals(HttpStatusCode.OK, deletion.status, deletion.bodyAsText())
                assertTrue(read(client, "GET", path).jsonArray.none { it.field("id") == deletedId })
                assertTrue(
                    read(
                        client,
                        "GET",
                        "$path?versionId=$version",
                    ).jsonArray.any { it.field("id") == deletedId },
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
