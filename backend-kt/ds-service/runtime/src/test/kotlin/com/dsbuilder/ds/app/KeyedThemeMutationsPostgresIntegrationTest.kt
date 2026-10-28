package com.dsbuilder.ds.app

import io.ktor.client.HttpClient
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

/** Результат и метаданные повторяются без второй записи даже после удаления предметной сущности. */
class KeyedThemeMutationsPostgresIntegrationTest {
    @Test
    fun `all keyed theme mutation methods replay exact results and preserve revisions`() {
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
                val system = payload(
                    api(
                        client,
                        "POST",
                        "/api/ds/design-systems",
                        """{"name":"keyed","projectName":"keyed"}""",
                    ),
                ).field("id")
                val tenant = payload(
                    api(
                        client,
                        "POST",
                        "/api/ds/tenants",
                        """{"designSystemId":"$system","name":"a"}""",
                    ),
                ).field("id")
                val base = "/api/ds/tenants/$tenant/palette"
                val group = replay(client, system, "POST", "$base/groups", """{"label":"A","editRevision":0}""")
                    .jsonObject.getValue("value").field("id")
                val patch = """{"label":"B","editRevision":0}"""
                replay(client, system, "PATCH", "$base/groups/$group", patch)
                val palette = payload(api(client, "GET", base))
                val token = palette.jsonObject.getValue("tokens").jsonArray.first().field("tokenId")
                replay(
                    client,
                    system,
                    "PUT",
                    "$base/token-groups/$token",
                    """{"groupId":"$group","editRevision":0}""",
                )
                replay(client, system, "DELETE", "$base/groups/$group", """{"editRevision":0}""")
                verifyAutosaveReplay(client, tenant, token)
                api(client, "GET", base, key = "read-key")
                DriverManager.getConnection(database.jdbcUrl, database.username, database.password).use { connection ->
                    connection.createStatement().use { statement ->
                        val query = "SELECT count(*) FROM idempotent_requests WHERE idempotency_key='read-key'"
                        statement.executeQuery(query).use {
                            it.next()
                            assertEquals(0, it.getInt(1))
                        }
                    }
                }
            }
        }
    }

    private suspend fun verifyAutosaveReplay(client: HttpClient, tenant: String, token: String) {
        val path = "/api/ds/tenants/$tenant/token-values"
        val original = payload(api(client, "GET", path)).jsonArray.first { it.field("tokenId") == token }
        fun body(revision: String, color: String) = """{"editRevision":0,"values":[{"tokenId":"$token",""" +
            """"platform":${original.jsonObject.getValue("platform")},""" +
            """"mode":${original.jsonObject.getValue("mode")},""" +
            """"paletteId":null,"value":["$color"],"baseRevision":$revision}]}"""
        val key = UUID.randomUUID().toString()
        val firstBody = body(original.field("editRevision"), "#123456")
        val first = api(client, "PUT", path, firstBody, key)
        assertEquals(HttpStatusCode.OK, first.status, first.bodyAsText())
        val metadata = assertNotNull(first.headers["X-DS-Mutation-Metadata"])
        assertTrue(Json.parseToJsonElement(metadata).jsonArray.isNotEmpty())
        val repeated = api(client, "PUT", path, firstBody, key)
        assertEquals(first.bodyAsText(), repeated.bodyAsText())
        assertEquals(metadata, repeated.headers["X-DS-Mutation-Metadata"])
        val saved = payload(repeated).jsonObject.getValue("values").jsonArray.single()
        val next = api(client, "PUT", path, body(saved.field("editRevision"), "#654321"))
        assertEquals(HttpStatusCode.OK, next.status, next.bodyAsText())
        val mismatch = api(client, "PUT", path, body(saved.field("editRevision"), "#abcdef"), key)
        assertEquals(HttpStatusCode.Conflict, mismatch.status, mismatch.bodyAsText())
        assertTrue(mismatch.bodyAsText().contains("IDEMPOTENCY_KEY_REUSED"))
        val nextValue = payload(next).jsonObject.getValue("values").jsonArray.single()
        verifyDirectValueReplay(client, path, nextValue)
    }

    private suspend fun verifyDirectValueReplay(client: HttpClient, tenantPath: String, value: JsonElement) {
        val path = "/api/ds/token-values/${value.field("id")}"
        val key = UUID.randomUUID().toString()
        val body = """{"value":["#abcdef"]}"""
        val revision = value.field("editRevision")
        val first = api(client, "PATCH", path, body, key, revision)
        assertEquals(HttpStatusCode.OK, first.status, first.bodyAsText())
        val second = api(client, "PATCH", path, body, key, revision)
        assertEquals(first.bodyAsText(), second.bodyAsText())
        assertEquals(first.headers["X-DS-Mutation-Metadata"], second.headers["X-DS-Mutation-Metadata"])
        val current = payload(api(client, "GET", tenantPath)).jsonArray.single { it.field("id") == value.field("id") }
        val deleteKey = UUID.randomUUID().toString()
        val deleted = api(client, "DELETE", path, key = deleteKey, baseRevision = current.field("editRevision"))
        assertEquals(HttpStatusCode.OK, deleted.status, deleted.bodyAsText())
        val replayed = api(client, "DELETE", path, key = deleteKey, baseRevision = current.field("editRevision"))
        assertEquals(deleted.status, replayed.status)
        assertEquals(deleted.bodyAsText(), replayed.bodyAsText())
        assertEquals(deleted.headers["X-DS-Mutation-Metadata"], replayed.headers["X-DS-Mutation-Metadata"])
        assertEquals(HttpStatusCode.NotFound, api(client, "GET", path).status)
    }

    private suspend fun replay(
        client: HttpClient,
        system: String,
        method: String,
        path: String,
        body: String,
    ): JsonElement {
        val key = UUID.randomUUID().toString()
        val first = api(client, method, path, body, key)
        val expectedStatus = if (method == "POST") HttpStatusCode.Created else HttpStatusCode.OK
        assertEquals(expectedStatus, first.status, first.bodyAsText())
        val cursor = payload(api(client, "GET", "/api/ds/design-systems/$system")).field("draftRevision")
        val second = api(client, method, path, body, key)
        assertEquals(first.status, second.status)
        assertEquals(first.bodyAsText(), second.bodyAsText())
        assertEquals(first.headers["X-DS-Mutation-Metadata"], second.headers["X-DS-Mutation-Metadata"])
        assertEquals(
            first.headers["X-DS-Mutation-Metadata-Truncated"],
            second.headers["X-DS-Mutation-Metadata-Truncated"],
        )
        assertEquals(cursor, payload(api(client, "GET", "/api/ds/design-systems/$system")).field("draftRevision"))
        return payload(first)
    }

    private suspend fun api(
        client: HttpClient,
        method: String,
        path: String,
        body: String? = null,
        key: String = UUID.randomUUID().toString(),
        baseRevision: String? = null,
    ): HttpResponse = client.request(path) {
        this.method = HttpMethod.parse(method)
        header("X-Actor-Type", "user")
        header("X-User-Id", "keyed-owner")
        header("X-Project-Id", "keyed-project")
        header("X-Project-Role", "owner")
        header("Idempotency-Key", key)
        baseRevision?.let { header("X-DS-Base-Revision", it) }
        body?.let {
            contentType(ContentType.Application.Json)
            setBody(it)
        }
    }

    private suspend fun payload(response: HttpResponse) = Json.parseToJsonElement(response.bodyAsText())
    private fun JsonElement.field(name: String) = jsonObject.getValue(name).jsonPrimitive.content
}
