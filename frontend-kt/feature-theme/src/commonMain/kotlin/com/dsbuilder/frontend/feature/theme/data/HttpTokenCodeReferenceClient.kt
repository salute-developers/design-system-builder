package com.dsbuilder.frontend.feature.theme.data

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClient
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.theme.application.TokenCodeReferenceClient
import com.dsbuilder.frontend.feature.theme.application.TokenCodeReferenceErrorCode
import com.dsbuilder.frontend.feature.theme.application.TokenCodeReferenceResult
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

private const val HTTP_UNAUTHORIZED = 401
private const val HTTP_NOT_FOUND = 404

/**
 * Ktor-реализация [TokenCodeReferenceClient] поверх API документации:
 * `publications/active` (без `version` — последняя публикация) и `publications/{id}/bindings?kind=token&subject=…`.
 */
public class HttpTokenCodeReferenceClient(
    private val httpClientFactory: AuthenticatedHttpClientFactory,
) : TokenCodeReferenceClient {
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun themeReference(
        apiUrl: String,
        credential: BackendCredential,
        projectId: String,
        designSystemId: String,
        platform: String,
        subjects: List<String>,
    ): TokenCodeReferenceResult {
        val client = httpClientFactory.create(apiUrl, credential)
        val base = "/api/projects/$projectId/documentation"
        val publication = activePublication(client, base, designSystemId, platform)
        val publicationId = publication.id ?: return publication.failure ?: unexpected()
        return findReference(client, base, publicationId, subjects)
    }

    private class PublicationLookup(val id: String?, val failure: TokenCodeReferenceResult? = null)

    private suspend fun activePublication(
        client: AuthenticatedHttpClient,
        base: String,
        designSystemId: String,
        platform: String,
    ): PublicationLookup =
        when (val active = client.get("$base/publications/active?designSystemId=$designSystemId&platform=$platform")) {
            is AuthenticatedHttpResult.Success -> PublicationLookup(parse(active.body)?.stringField("publicationId"))
            is AuthenticatedHttpResult.Failure -> PublicationLookup(null, active.toResult())
        }

    private suspend fun findReference(
        client: AuthenticatedHttpClient,
        base: String,
        publicationId: String,
        subjects: List<String>,
    ): TokenCodeReferenceResult {
        for (subject in subjects) {
            val path = "$base/publications/$publicationId/bindings?kind=token&limit=1&subject=${encode(subject)}"
            val body = when (val response = client.get(path)) {
                is AuthenticatedHttpResult.Success -> response.body
                is AuthenticatedHttpResult.Failure -> return response.toResult()
            }
            val item = parse(body)?.get("items")?.jsonArray?.firstOrNull()?.jsonObject
            val reference = item?.let(::themeReferenceOf)
            if (reference != null) return TokenCodeReferenceResult.Found(reference)
        }
        return TokenCodeReferenceResult.NotAvailable
    }

    /** `platformPayload` приходит объектом (или JSON-строкой); `themeReference` у типов без accessor'а — `null`/`"null"`. */
    private fun themeReferenceOf(binding: JsonObject): String? {
        val payload = when (val raw = binding["platformPayload"]) {
            is JsonObject -> raw
            is JsonPrimitive -> parse(raw.content)
            else -> null
        }
        return payload?.stringField("themeReference")?.takeIf { it.isNotBlank() && it != "null" }
    }

    private fun parse(body: String): JsonObject? =
        runCatching { json.parseToJsonElement(body).jsonObject }.getOrNull()

    private fun JsonObject.stringField(name: String): String? =
        (this[name] as? JsonElement)?.let { runCatching { it.jsonPrimitive.contentOrNull }.getOrNull() }

    private fun unexpected() = TokenCodeReferenceResult.Failed(
        TokenCodeReferenceErrorCode.BACKEND_UNAVAILABLE,
        "Error: unexpected documentation response.",
    )

    private fun AuthenticatedHttpResult.Failure.toResult(): TokenCodeReferenceResult = when (statusCode) {
        HTTP_NOT_FOUND -> TokenCodeReferenceResult.NotAvailable
        HTTP_UNAUTHORIZED -> TokenCodeReferenceResult.Failed(TokenCodeReferenceErrorCode.AUTH_REQUIRED, message)
        else -> TokenCodeReferenceResult.Failed(TokenCodeReferenceErrorCode.BACKEND_UNAVAILABLE, message)
    }

    private fun encode(value: String): String = buildString {
        value.encodeToByteArray().forEach { byte ->
            val int = byte.toInt() and 0xff
            val char = int.toChar()
            if (char.isLetterOrDigit() && int < 128 || char in "-._~") {
                append(char)
            } else {
                append("%" + int.toString(16).uppercase().padStart(2, '0'))
            }
        }
    }
}
