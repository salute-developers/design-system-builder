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
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Повтор специализированных записей сохраняется в PostgreSQL и предшествует проверке удалённой цели. */
class SpecializedMutationReplayHttpPostgresIntegrationTest {
    @Test
    fun `specialized writes replay after restart resource deletion and system deletion`() {
        IsolatedPostgresDatabase.create().use { database ->
            var prepared: Fixture? = null
            testApplication {
                application { module(configuration(database)) }
                val fixture = prepare(client)
                prepared = fixture
                val before = snapshot(database)
                rejectForeignCommands(client, fixture)
                assertEquals(before, snapshot(database), "Rejected commands changed persistent state")
                for (write in fixture.writes) {
                    val deleted = call(client, "DELETE", write.deletePath)
                    assertEquals(HttpStatusCode.OK, deleted.status, deleted.bodyAsText())
                    assertEquals(HttpStatusCode.NotFound, call(client, "GET", write.tokenPath).status)
                }
            }
            val fixture = requireNotNull(prepared)
            testApplication {
                application { module(configuration(database)) }
                replayWithoutWrites(client, database, fixture)
                val deleted = call(client, "DELETE", "$ROOT/${fixture.system}")
                assertEquals(HttpStatusCode.OK, deleted.status, deleted.bodyAsText())
            }
            testApplication {
                application { module(configuration(database)) }
                replayWithoutWrites(client, database, fixture)
            }
        }
    }

    private suspend fun prepare(client: HttpClient): Fixture {
        val system = createdId(call(client, "POST", ROOT, """{"name":"replay-a","projectName":"replay"}"""))
        val other = createdId(call(client, "POST", ROOT, """{"name":"replay-b","projectName":"replay"}"""))
        val tenant = createdId(call(client, "POST", "$ROOT/$system/tenants", """{"name":"replay-theme"}"""))
        val sizePath = "$ROOT/$system/tenants/$tenant/size-tokens"
        val sizes = read(client, sizePath)
        val writes = listOf("radii", "spacing", "shadows").map { section ->
            val token = sizes.getValue(section).jsonArray.first().jsonObject.getValue("tokenId").jsonPrimitive.content
            val body = if (section == "shadows") {
                """
                {"layers":[{"offsetX":0,"offsetY":1,"blur":2,"spread":0,"color":"#00000033"}],
                 "fallbackElevation":21}
                """.trimIndent()
            } else {
                """{"valuePx":21}"""
            }
            record(client, system, token, "PUT", "$sizePath/$token/value", "$sizePath/$token", body)
        }
        val stylePath = "$ROOT/$system/tenants/$tenant/typography-styles"
        val style = read(client, stylePath).getValue("screens").jsonArray.first().jsonObject
            .getValue("styles").jsonArray.first().jsonObject.getValue("variants").jsonObject
            .getValue("normal").jsonObject.getValue("tokenId").jsonPrimitive.content
        val typography = record(
            client,
            system,
            style,
            "PATCH",
            "$stylePath/$style",
            "$stylePath/$style",
            """{"size":21}""",
        )
        return Fixture(system, other, writes + typography)
    }

    private suspend fun record(
        client: HttpClient,
        system: String,
        token: String,
        method: String,
        path: String,
        deletePath: String,
        body: String,
    ): RecordedWrite {
        val key = UUID.randomUUID().toString()
        val response = call(client, method, path, body, key)
        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        return RecordedWrite(
            method, path, deletePath, "$ROOT/$system/tokens/$token", body, key, response.bodyAsText(),
            response.headers["X-DS-Mutation-Metadata"], response.headers["X-DS-Mutation-Metadata-Truncated"],
        )
    }

    private suspend fun rejectForeignCommands(client: HttpClient, fixture: Fixture) {
        for (write in fixture.writes) {
            val foreignPath = write.path.replace(fixture.system, fixture.other)
            assertEquals(HttpStatusCode.Conflict, call(client, write.method, foreignPath, write.body, write.key).status)
            assertEquals(HttpStatusCode.NotFound, call(client, write.method, foreignPath, write.body).status)
            val changed = write.body.replace("21", "23")
            assertEquals(HttpStatusCode.Conflict, call(client, write.method, write.path, changed, write.key).status)
            assertEquals(
                HttpStatusCode.Forbidden,
                call(client, write.method, write.path, write.body, write.key, "viewer").status,
            )
        }
    }

    private suspend fun replayWithoutWrites(client: HttpClient, database: IsolatedPostgresDatabase, fixture: Fixture) {
        val before = snapshot(database)
        for (write in fixture.writes) {
            val response = call(client, write.method, write.path, write.body, write.key)
            assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
            assertEquals(write.response, response.bodyAsText())
            assertEquals(write.metadata, response.headers["X-DS-Mutation-Metadata"])
            assertEquals(write.truncated, response.headers["X-DS-Mutation-Metadata-Truncated"])
            assertEquals(HttpStatusCode.NotFound, call(client, write.method, write.path, write.body).status)
            val foreign = write.path.replace(fixture.system, fixture.other)
            assertEquals(HttpStatusCode.Conflict, call(client, write.method, foreign, write.body, write.key).status)
        }
        assertEquals(before, snapshot(database), "Replay or rejected fresh command changed persistent state")
    }

    private suspend fun read(client: HttpClient, path: String): JsonObject {
        val response = call(client, "GET", path)
        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        return Json.parseToJsonElement(response.bodyAsText()).jsonObject
    }

    private suspend fun createdId(response: HttpResponse): String {
        assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
        return Json.parseToJsonElement(response.bodyAsText()).jsonObject.getValue("id").jsonPrimitive.content
    }

    private suspend fun call(
        client: HttpClient,
        method: String,
        path: String,
        body: String? = null,
        key: String? = UUID.randomUUID().toString(),
        role: String = "owner",
    ): HttpResponse = client.request(path) {
        this.method = HttpMethod.parse(method)
        header("X-Actor-Type", "user")
        header("X-User-Id", "replay-owner")
        header("X-Project-Id", "replay-project")
        header("X-Project-Role", role)
        key?.let { header("Idempotency-Key", it) }
        body?.let {
            contentType(ContentType.Application.Json)
            setBody(it)
        }
    }

    private fun configuration(database: IsolatedPostgresDatabase) = DsServiceConfiguration(
        0, database.jdbcUrl, database.username, database.password, 4, 5_000, null, true, false, null,
    )

    private fun snapshot(database: IsolatedPostgresDatabase): String = DriverManager.getConnection(
        database.jdbcUrl,
        database.username,
        database.password,
    ).use { connection ->
        connection.createStatement().use { statement ->
            val query = "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
            val tables = statement.executeQuery(query)
                .use { rows -> buildList { while (rows.next()) add(rows.getString(1)) } }
            tables.joinToString("\n") { table ->
                val checksum = "SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text, '')) " +
                    "FROM $table t"
                statement.executeQuery(checksum).use { rows ->
                    assertTrue(rows.next())
                    "$table:${rows.getString(1)}"
                }
            }
        }
    }

    private data class Fixture(val system: String, val other: String, val writes: List<RecordedWrite>)

    private data class RecordedWrite(
        val method: String,
        val path: String,
        val deletePath: String,
        val tokenPath: String,
        val body: String,
        val key: String,
        val response: String,
        val metadata: String?,
        val truncated: String?,
    )

    private companion object {
        const val ROOT = "/api/design-systems"
    }
}
