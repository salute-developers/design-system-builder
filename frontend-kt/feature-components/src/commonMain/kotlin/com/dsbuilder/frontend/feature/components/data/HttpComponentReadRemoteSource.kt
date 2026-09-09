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
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

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
        runtime.get(runtime.designSystemModelPath("components/${encodePath(command.identifier)}"))

    override suspend fun config(
        runtime: ComponentReadRuntime,
        command: ComponentConfigReadCommand,
    ): ComponentReadResult {
        val body = json.encodeToString(
            ComponentConfigExportRequest.serializer(),
            ComponentConfigExportRequest(
                designSystemId = runtime.context.designSystemId.value,
                components = listOf(command.identifier),
                styles = command.style?.let(::listOf),
            ),
        )
        return runtime.post("/api/projects/${runtime.context.projectId.value}/ds/component-config/export", body)
    }

    override suspend fun styles(runtime: ComponentReadRuntime, command: ComponentGetReadCommand): ComponentReadResult =
        runtime.get(runtime.designSystemModelPath("components/${encodePath(command.identifier)}/styles"))

    override suspend fun variations(
        runtime: ComponentReadRuntime,
        command: ComponentGetReadCommand,
    ): ComponentReadResult =
        runtime.get(runtime.designSystemModelPath("components/${encodePath(command.identifier)}/variations"))

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

@Serializable
private data class ComponentConfigExportRequest(
    val designSystemId: String,
    val components: List<String>,
    val styles: List<String>? = null,
)

private fun AuthenticatedHttpResult.Failure.toReadError(): ComponentReadResult.Failed {
    val code = when {
        message.contains("unauthorized", ignoreCase = true) -> ComponentReadErrorCode.AUTH_REQUIRED
        message.contains("forbidden", ignoreCase = true) -> ComponentReadErrorCode.FORBIDDEN
        message.contains("not found", ignoreCase = true) -> ComponentReadErrorCode.NOT_FOUND
        message.contains("HTTP 400", ignoreCase = true) -> ComponentReadErrorCode.INVALID_QUERY
        message.contains("unreachable", ignoreCase = true) -> ComponentReadErrorCode.BACKEND_UNAVAILABLE
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
