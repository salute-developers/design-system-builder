@file:Suppress("UndocumentedPublicClass")

package com.dsbuilder.frontend.feature.components.data

import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.components.application.ComponentReadErrorCode
import com.dsbuilder.frontend.feature.components.application.ComponentReadRemoteSource
import com.dsbuilder.frontend.feature.components.application.ComponentReadResult
import com.dsbuilder.frontend.feature.components.application.ComponentReadRuntime
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

public class HttpComponentReadRemoteSource(
    private val httpClientFactory: AuthenticatedHttpClientFactory,
    private val json: Json,
) : ComponentReadRemoteSource {
    override suspend fun configurations(
        runtime: ComponentReadRuntime,
        componentId: String,
        version: String,
        limit: Int,
        cursor: String?,
    ): ComponentReadResult = runtime.get(
        "/api/projects/${encodePart(runtime.context.projectId.value)}/ds/appearances?" +
            "designSystemId=${encodePart(runtime.context.designSystemId.value)}" +
            "&componentId=${encodePart(componentId)}&version=${encodePart(version)}&limit=$limit" +
            (cursor?.let { "&cursor=${encodePart(it)}" } ?: ""),
        version,
    )

    override suspend fun resolvedProperties(
        runtime: ComponentReadRuntime,
        appearanceId: String,
        selectedValueIds: List<String>,
        version: String,
    ): ComponentReadResult = runtime.get(
        runtime.selectionPath(appearanceId, "resolved-properties", selectedValueIds, version),
        version,
    )

    override suspend fun tokenReferences(
        runtime: ComponentReadRuntime,
        appearanceId: String,
        selectedValueIds: List<String>,
        version: String,
    ): ComponentReadResult = runtime.get(
        runtime.selectionPath(appearanceId, "token-references", selectedValueIds, version),
        version,
    )

    private suspend fun ComponentReadRuntime.get(path: String, version: String): ComponentReadResult =
        when (val response = httpClientFactory.create(apiUrl.value, credential).get(path)) {
            is AuthenticatedHttpResult.Success -> parseSuccess(response, context.designSystemId.value, version)
            is AuthenticatedHttpResult.Failure -> response.toReadError()
        }

    @Suppress("ReturnCount")
    private fun parseSuccess(
        response: AuthenticatedHttpResult.Success,
        designSystemId: String,
        version: String,
    ): ComponentReadResult {
        if (!response.readHeadersValid) return unreadableContext()
        val body = response.body
        val data = if (body.isBlank()) {
            JsonObject(emptyMap())
        } else {
            runCatching { json.parseToJsonElement(body) }.getOrNull()
                ?: return ComponentReadResult.Failed(
                    ComponentReadErrorCode.BACKEND_UNAVAILABLE,
                    "Backend returned unreadable JSON.",
                )
        }
        val context = response.headers["x-ds-read-context"]?.let { raw ->
            runCatching { json.parseToJsonElement(raw) as? JsonObject }.getOrNull()
                ?: return unreadableContext()
        } ?: return unreadableContext()
        if ((context["designSystemId"] as? JsonPrimitive)?.content != designSystemId ||
            (context["version"] as? JsonPrimitive)?.content != version
        ) {
            return unreadableContext()
        }
        return ComponentReadResult.Success(
            JsonObject(
                mapOf("source" to JsonPrimitive("design-system-model-api"), "context" to context, "data" to data),
            ),
        )
    }
}

private fun unreadableContext(): ComponentReadResult.Failed = ComponentReadResult.Failed(
    ComponentReadErrorCode.BACKEND_UNAVAILABLE,
    "Backend returned unreadable model read context.",
)

private fun ComponentReadRuntime.selectionPath(
    appearanceId: String,
    operation: String,
    selectedValueIds: List<String>,
    version: String,
): String = "/api/projects/${encodePart(context.projectId.value)}/ds/appearances/" +
    "${encodePart(appearanceId)}/$operation?version=${encodePart(version)}" +
    selectedValueIds.joinToString("") { "&selectedValueId=${encodePart(it)}" }

private fun encodePart(value: String): String = buildString {
    value.encodeToByteArray().forEach { raw ->
        val byte = raw.toInt() and 0xff
        val letter = byte in 'a'.code..'z'.code || byte in 'A'.code..'Z'.code
        if (letter || byte in '0'.code..'9'.code || byte.toChar() in "-._~") {
            append(byte.toChar())
        } else {
            append("%" + byte.toString(16).uppercase().padStart(2, '0'))
        }
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
