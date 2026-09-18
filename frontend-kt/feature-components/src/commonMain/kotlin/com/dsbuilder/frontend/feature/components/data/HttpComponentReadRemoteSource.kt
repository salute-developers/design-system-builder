@file:Suppress("UndocumentedPublicClass")

package com.dsbuilder.frontend.feature.components.data

import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.components.application.ComponentConfigReadCommand
import com.dsbuilder.frontend.feature.components.application.ComponentGetReadCommand
import com.dsbuilder.frontend.feature.components.application.ComponentListReadCommand
import com.dsbuilder.frontend.feature.components.application.ComponentReadErrorCode
import com.dsbuilder.frontend.feature.components.application.ComponentReadRemoteSource
import com.dsbuilder.frontend.feature.components.application.ComponentReadResult
import com.dsbuilder.frontend.feature.components.application.ComponentReadRuntime
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

public class HttpComponentReadRemoteSource(
    private val httpClientFactory: AuthenticatedHttpClientFactory,
    private val json: Json,
) : ComponentReadRemoteSource {
    override suspend fun list(
        runtime: ComponentReadRuntime,
        command: ComponentListReadCommand,
    ): ComponentReadResult =
        runtime.get(runtime.designSystemModelPath("components") + queryString("query" to command.query))

    override suspend fun get(runtime: ComponentReadRuntime, command: ComponentGetReadCommand): ComponentReadResult =
        runtime.get(runtime.projectModelPath("components/${encodePath(command.componentId)}"))

    override suspend fun config(
        runtime: ComponentReadRuntime,
        command: ComponentConfigReadCommand,
    ): ComponentReadResult {
        val body = json.encodeToString(
            JsonObject.serializer(),
            buildJsonObject {
                put("designSystemId", runtime.context.designSystemId.value)
                put("components", JsonArray(listOf(JsonPrimitive(command.identifier))))
                command.style?.let { put("styles", JsonArray(listOf(JsonPrimitive(it)))) }
            },
        )
        return runtime.post("/api/projects/${runtime.context.projectId.value}/ds/component-config/export", body)
    }

    override suspend fun styles(runtime: ComponentReadRuntime, command: ComponentGetReadCommand): ComponentReadResult =
        runtime.get(runtime.designSystemModelPath("components/${encodePath(command.componentId)}/styles"))

    override suspend fun variations(
        runtime: ComponentReadRuntime,
        command: ComponentGetReadCommand,
    ): ComponentReadResult =
        runtime.get(runtime.projectModelPath("components/${encodePath(command.componentId)}/variations"))

    override suspend fun tokens(runtime: ComponentReadRuntime): ComponentReadResult =
        runtime.get(runtime.designSystemModelPath("tokens"))

    override suspend fun tokens(runtime: ComponentReadRuntime): ComponentReadResult =
        runtime.get(runtime.designSystemModelPath("tokens"))

    private suspend fun ComponentReadRuntime.get(path: String): ComponentReadResult =
        when (val response = httpClientFactory.create(apiUrl.value, credential).get(path)) {
            is AuthenticatedHttpResult.Success -> parseSuccess(response.body)
            is AuthenticatedHttpResult.Failure -> response.toReadError()
        }

    private suspend fun ComponentReadRuntime.post(path: String, body: String): ComponentReadResult =
        when (val response = httpClientFactory.create(apiUrl.value, credential).post(path, body)) {
            is AuthenticatedHttpResult.Success -> parseSuccess(response.body)
            is AuthenticatedHttpResult.Failure -> response.toReadError()
        }

    private fun parseSuccess(body: String): ComponentReadResult {
        val data = if (body.isBlank()) {
            JsonObject(emptyMap())
        } else {
            runCatching { json.parseToJsonElement(body) }.getOrNull()
                ?: return ComponentReadResult.Failed(
                    ComponentReadErrorCode.BACKEND_UNAVAILABLE,
                    "Backend returned unreadable JSON.",
                )
        }
        return ComponentReadResult.Success(
            JsonObject(mapOf("source" to JsonPrimitive("design-system-model-api"), "data" to data)),
        )
    }
}

private fun AuthenticatedHttpResult.Failure.toReadError(): ComponentReadResult.Failed {
    val code = when (statusCode) {
        401 -> ComponentReadErrorCode.AUTH_REQUIRED
        403 -> ComponentReadErrorCode.FORBIDDEN
        404 -> ComponentReadErrorCode.NOT_FOUND
        400 -> ComponentReadErrorCode.INVALID_QUERY
        else -> ComponentReadErrorCode.BACKEND_UNAVAILABLE
    }
    return ComponentReadResult.Failed(code, message)
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

private fun ComponentReadRuntime.designSystemModelPath(path: String): String =
    "/api/projects/${context.projectId.value}/ds/design-systems/${context.designSystemId.value}/$path"

private fun ComponentReadRuntime.projectModelPath(path: String): String =
    "/api/projects/${context.projectId.value}/ds/$path"
