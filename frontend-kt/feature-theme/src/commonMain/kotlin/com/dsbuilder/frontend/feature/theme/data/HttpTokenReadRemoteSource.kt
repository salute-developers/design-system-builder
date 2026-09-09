@file:Suppress("UndocumentedPublicClass")

package com.dsbuilder.frontend.feature.theme.data

import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.theme.application.TokenGetReadCommand
import com.dsbuilder.frontend.feature.theme.application.TokenListReadCommand
import com.dsbuilder.frontend.feature.theme.application.TokenReadErrorCode
import com.dsbuilder.frontend.feature.theme.application.TokenReadRemoteSource
import com.dsbuilder.frontend.feature.theme.application.TokenReadResult
import com.dsbuilder.frontend.feature.theme.application.TokenReadRuntime
import com.dsbuilder.frontend.feature.theme.application.TokenValuesReadCommand
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

public class HttpTokenReadRemoteSource(
    private val httpClientFactory: AuthenticatedHttpClientFactory,
    private val json: Json,
) : TokenReadRemoteSource {
    override suspend fun list(runtime: TokenReadRuntime, command: TokenListReadCommand): TokenReadResult =
        runtime.get(
            runtime.designSystemModelPath("tokens") + queryString("type" to command.type, "query" to command.query),
        )

    override suspend fun get(runtime: TokenReadRuntime, command: TokenGetReadCommand): TokenReadResult =
        runtime.get(runtime.designSystemModelPath("tokens/${encodePath(command.identifier)}"))

    override suspend fun values(runtime: TokenReadRuntime, command: TokenValuesReadCommand): TokenReadResult =
        runtime.get(
            runtime.designSystemModelPath("tokens/${encodePath(command.identifier)}/values") +
                queryString(
                    "tenantId" to command.tenantId,
                    "themeId" to command.themeId,
                    "mode" to command.mode,
                    "platform" to command.platform,
                ),
        )

    private suspend fun TokenReadRuntime.get(path: String): TokenReadResult =
        when (val response = httpClientFactory.create(apiUrl.value, credential).get(path)) {
            is AuthenticatedHttpResult.Success -> parseSuccess(response.body)
            is AuthenticatedHttpResult.Failure -> response.toReadError()
        }

    private fun parseSuccess(body: String): TokenReadResult {
        val data = if (body.isBlank()) {
            JsonObject(emptyMap())
        } else {
            runCatching { json.parseToJsonElement(body) }.getOrNull()
                ?: return TokenReadResult.Failed(
                    TokenReadErrorCode.BACKEND_UNAVAILABLE,
                    "Backend returned unreadable JSON.",
                )
        }
        return TokenReadResult.Success(
            JsonObject(mapOf("source" to JsonPrimitive("design-system-model-api"), "data" to data)),
        )
    }
}

private fun AuthenticatedHttpResult.Failure.toReadError(): TokenReadResult.Failed {
    val code = when {
        message.contains("unauthorized", ignoreCase = true) -> TokenReadErrorCode.AUTH_REQUIRED
        message.contains("forbidden", ignoreCase = true) -> TokenReadErrorCode.FORBIDDEN
        message.contains("not found", ignoreCase = true) -> TokenReadErrorCode.NOT_FOUND
        message.contains("HTTP 400", ignoreCase = true) -> TokenReadErrorCode.INVALID_QUERY
        message.contains("unreachable", ignoreCase = true) -> TokenReadErrorCode.BACKEND_UNAVAILABLE
        else -> TokenReadErrorCode.BACKEND_UNAVAILABLE
    }
    return TokenReadResult.Failed(code, message)
}

private fun queryString(vararg parts: Pair<String, String?>): String {
    val values = parts.filter { it.second != null }.joinToString("&") { (name, value) ->
        "${encode(name)}=${encode(value.orEmpty())}"
    }
    return if (values.isEmpty()) "" else "?$values"
}

private fun encodePath(value: String): String = value.split("/").joinToString("/") { encode(it) }

private fun encode(value: String): String = buildString {
    value.encodeToByteArray().forEach { byte ->
        val int = byte.toInt() and 0xff
        val char = int.toChar()
        if (char.isLetterOrDigit() || char in "-._~") {
            append(char)
        } else {
            append("%" + int.toString(16).uppercase().padStart(2, '0'))
        }
    }
}

private fun TokenReadRuntime.designSystemModelPath(path: String): String =
    "/api/projects/${context.projectId.value}/ds/design-systems/${context.designSystemId.value}/$path"
