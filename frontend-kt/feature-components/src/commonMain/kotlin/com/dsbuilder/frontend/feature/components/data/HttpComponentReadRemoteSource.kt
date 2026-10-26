@file:Suppress("UndocumentedPublicClass")

package com.dsbuilder.frontend.feature.components.data

import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.components.application.ComponentConfigReadCommand
import com.dsbuilder.frontend.feature.components.application.ComponentReadErrorCode
import com.dsbuilder.frontend.feature.components.application.ComponentReadRemoteSource
import com.dsbuilder.frontend.feature.components.application.ComponentReadResult
import com.dsbuilder.frontend.feature.components.application.ComponentReadRuntime
import com.dsbuilder.frontend.feature.components.domain.apimeta.toApiMetaPlatform
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
    override suspend fun config(
        runtime: ComponentReadRuntime,
        command: ComponentConfigReadCommand,
    ): ComponentReadResult {
        val body = json.encodeToString(
            JsonObject.serializer(),
            buildJsonObject {
                put("designSystemId", runtime.context.designSystemId.value)
                runtime.context.platforms.singleOrNull()?.let { put("platform", it.toApiMetaPlatform()) }
                put("components", JsonArray(listOf(JsonPrimitive(command.identifier))))
                command.style?.let { put("styles", JsonArray(listOf(JsonPrimitive(it)))) }
            },
        )
        return runtime.post("/api/projects/${runtime.context.projectId.value}/ds/component-config/export", body)
    }

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

private fun ComponentReadRuntime.designSystemModelPath(path: String): String =
    "/api/projects/${context.projectId.value}/ds/design-systems/${context.designSystemId.value}/$path"
