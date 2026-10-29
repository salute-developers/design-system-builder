package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.feature.docs.application.CodeBindingGetCommand
import com.dsbuilder.frontend.feature.docs.application.CodeBindingSearchCommand
import com.dsbuilder.frontend.feature.docs.application.DocsReadUseCases
import kotlinx.serialization.json.JsonObject

/** Допустимая серверная проекция опубликованной привязки. */
internal enum class CodeBindingDetail(val wireValue: String) {
    SUMMARY("summary"),
    VARIATIONS("variations"),
    FULL("full"),
    ;

    internal companion object {
        fun parse(value: String): CodeBindingDetail? = entries.singleOrNull { it.wireValue == value }
    }
}

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
                publicationId = arguments.optional("publicationId"),
            ),
            runtimeRequest(arguments),
        ).toMcpResult()
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
                detail = detail.wireValue,
                appearanceNames = appearanceNames,
                variationNames = variationNames,
            ),
            runtimeRequest(arguments),
        ).toMcpResult()
    }
}
