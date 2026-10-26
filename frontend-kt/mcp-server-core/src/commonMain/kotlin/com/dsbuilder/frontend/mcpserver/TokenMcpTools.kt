package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.feature.theme.application.TokenGetReadCommand
import com.dsbuilder.frontend.feature.theme.application.TokenListReadCommand
import com.dsbuilder.frontend.feature.theme.application.TokenReadUseCases
import com.dsbuilder.frontend.feature.theme.application.TokenValuesReadCommand
import kotlinx.serialization.json.JsonObject

/** Адаптирует прикладные операции своего семейства к MCP. */
internal class TokenMcpTools(
    private val tokenReadUseCases: TokenReadUseCases?,
    private val context: McpReadToolContext,
) {
    suspend fun tokensList(arguments: JsonObject): McpToolResult = with(context) {
        val name = arguments.optional("name")
        val query = arguments.optional("query")
        if (name != null && query != null) return@with invalidArgument("name and query are mutually exclusive")
        val useCases = tokenReadUseCases ?: return@with backendReaderUnavailable()
        return@with useCases.list(
            TokenListReadCommand(arguments.optional("type"), name ?: query),
            runtimeRequest(arguments),
        ).toMcpResult().let {
            compactTokenList(it, json, name, arguments.optional("limit")?.toIntOrNull())
        }
    }

    suspend fun tokenGet(arguments: JsonObject): McpToolResult = with(context) {
        val tokenId = arguments.required("tokenId") ?: return@with invalidArgument("tokenId is required")
        val useCases = tokenReadUseCases ?: return@with backendReaderUnavailable()
        return@with useCases.get(
            TokenGetReadCommand(tokenId),
            runtimeRequest(arguments),
        ).toMcpResult()
    }

    suspend fun tokenValuesGet(arguments: JsonObject): McpToolResult = with(context) {
        val tokenId = arguments.required("tokenId") ?: return@with invalidArgument("tokenId is required")
        val useCases = tokenReadUseCases ?: return@with backendReaderUnavailable()
        return@with useCases.values(
            TokenValuesReadCommand(
                tokenId = tokenId,
                tenantId = arguments.optional("tenantId"),
                mode = arguments.optional("mode"),
                platform = arguments.optional("platform"),
            ),
            runtimeRequest(arguments),
        ).toMcpResult()
    }
}
