package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.core.application.ContextSelection
import com.dsbuilder.frontend.core.application.RuntimeRequest
import com.dsbuilder.frontend.feature.components.application.ComponentReadResult
import com.dsbuilder.frontend.feature.docs.application.DocsReadResult
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

/** Общие правила аргументов, контекста и результатов read-only MCP-инструментов. */
internal class McpReadToolContext(
    private val config: McpServerConfig,
    internal val json: Json,
) {
    fun runtimeRequest(arguments: JsonObject): RuntimeRequest = RuntimeRequest(
        selection = arguments.optional("designSystem")?.let { ContextSelection.Link(it) }
            ?: ContextSelection.Local(config.workspace),
        apiUrlOverride = config.apiUrlOverride,
    )

    fun success(body: String): McpToolResult = McpToolResult(isError = false, body = body.ifBlank { "{}" })

    fun toolError(code: String, message: String): McpToolResult =
        McpToolResult(isError = true, body = json.encodeToString(McpToolError(code, message)))

    fun invalidArgument(message: String): McpToolResult = toolError("INVALID_ARGUMENT", message)

    fun backendReaderUnavailable(): McpToolResult =
        toolError("BACKEND_UNAVAILABLE", "Backend read tools are not configured.")

    fun DocsReadResult.toMcpResult(): McpToolResult =
        when (this) {
            is DocsReadResult.Failed -> toolError(code.name, message)
            is DocsReadResult.Success -> success(json.encodeToString(value))
        }

    fun ComponentReadResult.toMcpResult(): McpToolResult =
        when (this) {
            is ComponentReadResult.Failed -> toolError(code.name, message)
            is ComponentReadResult.Success -> success(json.encodeToString(value))
        }

    fun JsonObject.required(name: String): String? = optional(name)?.takeIf(String::isNotBlank)

    fun JsonObject.optional(name: String, default: String? = null): String? =
        (this[name] as? JsonPrimitive)?.contentOrNull?.takeIf(String::isNotBlank) ?: default

    @Suppress("ReturnCount")
    fun JsonObject.optionalStringArray(name: String): List<String>? {
        val value = this[name] ?: return emptyList()
        val array = value as? JsonArray ?: return null
        return array.map { element ->
            (element as? JsonPrimitive)
                ?.takeIf(JsonPrimitive::isString)
                ?.contentOrNull
                ?.takeIf(String::isNotBlank)
                ?: return null
        }
    }
}
