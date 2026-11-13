package com.dsbuilder.ds.app

import io.ktor.client.HttpClient
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.contentType
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.util.UUID

/** Общая HTTP-фикстура узких тестов и отдельного измерительного стенда журнала. */
internal class JournalHttpFixture(private val client: HttpClient) {
    suspend fun get(path: String): JsonElement = call("GET", path)

    suspend fun seed(changes: Int = 9): JsonObject {
        val themes = linkedMapOf<String, JsonElement>()
        for (kind in listOf("new", "published")) {
            val system = call(
                "POST",
                "/api/design-systems",
                """{"name":"Journal $kind","projectName":"journal-$kind"}""",
            )
                .jsonObject.string("id")
            val root = "/api/design-systems/$system"
            val tenant = call("POST", "$root/tenants", """{"name":"Journal theme"}""").jsonObject.string("id")
            var version: JsonElement? = null
            if (kind == "published") {
                val cursor = get(root).jsonObject
                val body = buildJsonObject {
                    put("draftId", cursor.getValue("draftId"))
                    put("draftRevision", cursor.getValue("draftRevision"))
                    put("version", JsonPrimitive("1.0.0"))
                }
                version = call("POST", "$root/versions", body.toString()).jsonObject.getValue("id")
            }
            val values = get("$root/tenants/$tenant/token-values?types=color").jsonArray.take(changes)
            for (value in values) {
                call("PATCH", "$root/token-values/${value.jsonObject.string("id")}", """{"value":["#123456"]}""")
            }
            themes[kind] = buildJsonObject {
                put("system", JsonPrimitive(system))
                put("tenant", JsonPrimitive(tenant))
                version?.let { put("versionId", it) }
            }
        }
        return JsonObject(themes)
    }

    suspend fun request(
        method: String,
        path: String,
        body: String? = null,
        project: String = "performance-project",
        role: String = "owner",
    ): io.ktor.client.statement.HttpResponse = client.request(path) {
        this.method = HttpMethod.parse(method)
        header("X-Actor-Type", "user")
        header("X-User-Id", "performance-user")
        header("X-Project-Id", project)
        header("X-Project-Role", role)
        header("X-DS-Base-Revision", "0")
        header("Idempotency-Key", UUID.randomUUID().toString())
        if (body != null) {
            contentType(ContentType.Application.Json)
            setBody(body)
        }
    }
    suspend fun call(method: String, path: String, body: String? = null): JsonElement {
        val response = request(method, path, body)
        val text = response.bodyAsText()
        check(response.status.value in 200..299) { "$method $path: $text" }
        return Json.parseToJsonElement(text)
    }
}

private fun JsonObject.string(name: String): String = getValue(name).jsonPrimitive.content
