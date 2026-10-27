package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.feature.components.application.ComponentReadUseCases
import kotlinx.serialization.json.JsonObject

/** Адаптирует серверные чтения конфигураций компонента к MCP. */
internal class ComponentMcpTools(
    private val componentReadUseCases: ComponentReadUseCases?,
    private val context: McpReadToolContext,
) {
    suspend fun configurationsList(arguments: JsonObject): McpToolResult = with(context) {
        val componentId = arguments.required("componentId")
            ?: return@with invalidArgument("componentId is required")
        val limit = arguments.optional("limit")?.toIntOrNull() ?: 20
        val useCases = componentReadUseCases ?: return@with backendReaderUnavailable()
        useCases.configurations(
            componentId,
            arguments.optional("version"),
            limit,
            arguments.optional("cursor"),
            runtimeRequest(arguments),
        ).toMcpResult()
    }

    suspend fun componentConfigGet(arguments: JsonObject): McpToolResult = with(context) {
        val appearanceId = arguments.required("appearanceId")
            ?: return@with invalidArgument("appearanceId is required")
        val ids = arguments.optionalStringArray("selectedValueIds")
            ?: return@with invalidArgument("selectedValueIds must be an array of IDs")
        val useCases = componentReadUseCases ?: return@with backendReaderUnavailable()
        useCases.resolvedProperties(
            appearanceId,
            ids,
            arguments.optional("version"),
            runtimeRequest(arguments),
        ).toMcpResult()
    }

    suspend fun componentTokensGet(arguments: JsonObject): McpToolResult = with(context) {
        val appearanceId = arguments.required("appearanceId")
            ?: return@with invalidArgument("appearanceId is required")
        val ids = arguments.optionalStringArray("selectedValueIds")
            ?: return@with invalidArgument("selectedValueIds must be an array of IDs")
        val useCases = componentReadUseCases ?: return@with backendReaderUnavailable()
        useCases.tokenReferences(
            appearanceId,
            ids,
            arguments.optional("version"),
            runtimeRequest(arguments),
        ).toMcpResult()
    }
}
