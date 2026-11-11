package com.dsbuilder.frontend.feature.theme.data

import com.dsbuilder.frontend.core.application.RuntimeResolution
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.HttpMutationResult
import com.dsbuilder.frontend.core.network.editorReadResponse
import com.dsbuilder.frontend.core.network.encodeEditorId
import com.dsbuilder.frontend.feature.theme.application.TokenEditDataSource
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Собирает исходные данные существующими чтениями одной системы без записи. */
internal class HttpTokenEditDataSource(private val clients: AuthenticatedHttpClientFactory) : TokenEditDataSource {
    override suspend fun read(
        runtime: RuntimeResolution.Resolved,
        tokenId: String,
        tenantId: String,
    ): HttpMutationResult {
        val root = "/api/projects/${runtime.context.projectId.value.encodeEditorId()}" +
            "/design-systems/${runtime.context.designSystemId.value.encodeEditorId()}"
        val client = clients.create(runtime.apiUrl.value, runtime.credential)
        val paths = listOf(
            "$root/tokens/${tokenId.encodeEditorId()}",
            "$root/tenants/${tenantId.encodeEditorId()}",
            "$root/tokens",
            "$root/tenants/${tenantId.encodeEditorId()}/token-values",
        )
        val responses = mutableListOf<HttpMutationResult.Response>()
        for (path in paths) {
            val response = client.editorReadResponse(path)
            if (response.statusCode !in 200..299) return response
            responses += response
        }
        return combineTokenEditData(responses[0], responses[1], responses[2], responses[3])
    }
}

private fun combineTokenEditData(
    token: HttpMutationResult.Response,
    tenant: HttpMutationResult.Response,
    definitions: HttpMutationResult.Response,
    values: HttpMutationResult.Response,
): HttpMutationResult.Response = try {
    val definition = parseObject(token)
    val theme = parseObject(tenant)
    val allDefinitions = parseArray(definitions)
    val allValues = parseArray(values)
    val key = definition.colorFamilyKey()
    val members = if (key == null) {
        listOf(definition)
    } else {
        allDefinitions.filterIsInstance<JsonObject>()
            .filter { it.colorFamilyKey() == key }
    }
    val memberIds = members.mapNotNull { it.text("id") }.toSet()
    val body = buildJsonObject {
        put("definition", definition)
        theme["editRevision"]?.let { put("editRevision", it) }
        put("members", JsonArray(members))
        put("values", JsonArray(allValues.filter { (it as? JsonObject)?.text("tokenId") in memberIds }))
    }
    HttpMutationResult.Response(200, body.toString(), token.headers, token.metadataValid)
} catch (exception: IllegalArgumentException) {
    invalidTokenEditData()
}

private fun invalidTokenEditData(): HttpMutationResult.Response = HttpMutationResult.Response(
    502,
    "{\"message\":\"Invalid editor source response.\"}",
    emptyMap(),
    false,
)

private fun JsonObject.text(name: String): String? = (get(name) as? JsonPrimitive)?.content

/** Соответствует распознаванию семейства ColorTokenFamily.of на backend. */
private fun JsonObject.colorFamilyKey(): Pair<String, String>? {
    val segments = text("name").orEmpty().split('.')
    if (text("type") !in setOf("color", "gradient") || segments.size != 3 ||
        segments.any { !nameSegment.matches(it) }
    ) {
        return null
    }
    val (group, subgroup, member) = segments
    val contexts = if (group == "background") {
        setOf("default", "dark", "light", "inverse")
    } else {
        setOf("default", "on-dark", "on-light", "inverse")
    }
    if (group in setOf("light", "dark") || subgroup !in contexts) return null
    val name = listOf("hover", "active", "brightness").firstNotNullOfOrNull { state ->
        member.removeSuffix("-$state").takeIf { it != member }
    } ?: member
    return group to name
}

private val nameSegment = Regex("^[a-z0-9]+(?:-[a-z0-9]+)*$")

private fun parseObject(response: HttpMutationResult.Response): JsonObject =
    Json.parseToJsonElement(response.body) as? JsonObject ?: throw IllegalArgumentException("Expected an object.")

private fun parseArray(response: HttpMutationResult.Response): JsonArray =
    Json.parseToJsonElement(response.body) as? JsonArray ?: throw IllegalArgumentException("Expected an array.")
