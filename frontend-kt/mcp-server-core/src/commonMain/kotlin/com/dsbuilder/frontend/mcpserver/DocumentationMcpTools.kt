package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.feature.docs.application.DocsReadUseCases
import com.dsbuilder.frontend.feature.docs.application.DocumentationFetchCommand
import com.dsbuilder.frontend.feature.docs.application.DocumentationPageCommand
import com.dsbuilder.frontend.feature.docs.application.DocumentationPublicationCommand
import com.dsbuilder.frontend.feature.docs.application.DocumentationPublicationsCommand
import com.dsbuilder.frontend.feature.docs.application.DocumentationSearchCommand
import kotlinx.serialization.json.JsonObject

/** Адаптирует прикладные операции своего семейства к MCP. */
internal class DocumentationMcpTools(
    private val docsReadUseCases: DocsReadUseCases?,
    private val context: McpReadToolContext,
) {
    suspend fun publicationsList(arguments: JsonObject): McpToolResult = with(context) {
        val useCases = docsReadUseCases ?: return@with backendReaderUnavailable()
        useCases.publications(
            DocumentationPublicationsCommand(
                arguments.optional("version"),
                arguments.optional("platform"),
                arguments.optional("limit"),
                arguments.optional("cursor"),
            ),
            runtimeRequest(arguments),
        ).toMcpResult()
    }

    suspend fun documentationSearch(arguments: JsonObject): McpToolResult = with(context) {
        val query = arguments.required("query") ?: return@with invalidArgument("query is required")
        val subjects = arguments.optionalStringArray("subjects")
            ?: return@with invalidArgument("subjects must be an array of strings")
        val useCases = docsReadUseCases ?: return@with backendReaderUnavailable()
        return@with useCases.search(
            DocumentationSearchCommand(
                query = query,
                version = arguments.optional("version"),
                platform = arguments.optional("platform"),
                cursor = arguments.optional("cursor"),
                limit = arguments.optional("limit"),
                subject = arguments.optional("subject"),
                publicationId = arguments.optional("publicationId"),
                subjects = subjects,
            ),
            runtimeRequest(arguments),
        ).toMcpResult()
    }

    suspend fun documentationFetch(arguments: JsonObject): McpToolResult = with(context) {
        val kbUrl = arguments.required("kbUrl") ?: return@with invalidArgument("kbUrl is required")
        val useCases = docsReadUseCases ?: return@with backendReaderUnavailable()
        return@with useCases.fetch(
            DocumentationFetchCommand(kbUrl),
            runtimeRequest(arguments),
        ).toMcpResult()
    }

    suspend fun documentationNavigation(arguments: JsonObject): McpToolResult = with(context) {
        val useCases = docsReadUseCases ?: return@with backendReaderUnavailable()
        return@with useCases.navigation(
            DocumentationPublicationCommand(
                arguments.optional("version"),
                arguments.optional("platform"),
                arguments.optional("publicationId"),
            ),
            runtimeRequest(arguments),
        ).toMcpResult()
    }

    suspend fun documentationPage(arguments: JsonObject): McpToolResult = with(context) {
        val path = arguments.required("path") ?: return@with invalidArgument("path is required")
        val useCases = docsReadUseCases ?: return@with backendReaderUnavailable()
        return@with useCases.page(
            DocumentationPageCommand(
                path,
                arguments.optional("version"),
                arguments.optional("platform"),
                arguments.optional("publicationId"),
            ),
            runtimeRequest(arguments),
        ).toMcpResult()
    }
}
