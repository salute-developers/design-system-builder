package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.feature.docs.application.CodeBindingGetCommand
import com.dsbuilder.frontend.feature.docs.application.CodeBindingSearchCommand
import com.dsbuilder.frontend.feature.docs.application.DocsReadUseCases
import kotlinx.serialization.json.JsonObject

/** Адаптирует прикладные операции своего семейства к MCP. */
internal class CodeBindingMcpTools(
    private val docsReadUseCases: DocsReadUseCases?,
    private val context: McpReadToolContext,
) {
    suspend fun codeBindingSearch(arguments: JsonObject): McpToolResult = with(context) {
        val useCases = docsReadUseCases ?: return@with backendReaderUnavailable()
        return@with useCases.searchBindings(
            CodeBindingSearchCommand(
                subject = arguments.optional("subject"),
                kind = arguments.optional("kind"),
                name = arguments.optional("name"),
                limit = arguments.optional("limit"),
                cursor = arguments.optional("cursor"),
                version = arguments.optional("version"),
                platform = arguments.optional("platform"),
            ),
            runtimeRequest(arguments),
        ).toMcpResult().let { compactBindingSearch(json, it) }
    }

    @Suppress("ReturnCount")
    suspend fun codeBindingGet(arguments: JsonObject): McpToolResult = with(context) {
        val bindingId = arguments.required("bindingId") ?: return@with invalidArgument("bindingId is required")
        val appearanceNames = arguments.optionalStringArray("appearanceNames")
            ?: return@with invalidArgument("appearanceNames must be an array of non-empty strings")
        val variationNames = arguments.optionalStringArray("variationNames")
            ?: return@with invalidArgument("variationNames must be an array of non-empty strings")
        val requestedDetail = arguments.optional("detail")
        val detail = requestedDetail?.let(CodeBindingDetail::parse)
            ?: if (requestedDetail != null) {
                return@with invalidArgument("detail must be one of: summary, variations, full")
            } else if (variationNames.isNotEmpty()) {
                CodeBindingDetail.VARIATIONS
            } else {
                CodeBindingDetail.SUMMARY
            }
        if (detail == CodeBindingDetail.SUMMARY && variationNames.isNotEmpty()) {
            return@with invalidArgument("variationNames requires detail variations or full")
        }
        val useCases = docsReadUseCases ?: return@with backendReaderUnavailable()
        return@with useCases.getBinding(
            CodeBindingGetCommand(
                bindingId = bindingId,
                publicationId = arguments.optional("publicationId"),
                version = arguments.optional("version"),
                platform = arguments.optional("platform"),
            ),
            runtimeRequest(arguments),
        ).toMcpResult().let {
            projectComponentBinding(it, json, appearanceNames.toSet(), variationNames.toSet(), detail)
        }
    }
}
