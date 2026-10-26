package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.feature.components.application.ComponentConfigReadCommand
import com.dsbuilder.frontend.feature.components.application.ComponentConfigView
import com.dsbuilder.frontend.feature.components.application.ComponentProjectedConfigReadCommand
import com.dsbuilder.frontend.feature.components.application.ComponentReadErrorCode
import com.dsbuilder.frontend.feature.components.application.ComponentReadResult
import com.dsbuilder.frontend.feature.components.application.ComponentReadUseCases
import kotlinx.serialization.json.JsonObject

/** Адаптирует прикладные операции своего семейства к MCP. */
internal class ComponentMcpTools(
    private val componentReadUseCases: ComponentReadUseCases?,
    private val context: McpReadToolContext,
) {
    @Suppress("ReturnCount", "CyclomaticComplexMethod")
    suspend fun componentConfigGet(arguments: JsonObject): McpToolResult = with(context) {
        val name = arguments.optional("subject")?.toComponentPackageName()
            ?: arguments.optional("name")
            ?: return@with invalidArgument("subject or name is required")
        val selection = parseVariationSelection(arguments.optional("selection"))
            ?: return@with invalidArgument(
                "selection must be comma-separated variationId=value pairs without duplicates",
            )
        val projection = arguments.optional("projection") ?: "full"
        if (projection !in setOf("full", "token-references")) {
            return@with invalidArgument("projection must be full or token-references")
        }
        if (projection == "token-references" && selection.isEmpty()) {
            return@with invalidArgument("selection is required for token-references projection")
        }
        val useCases = componentReadUseCases ?: return@with backendReaderUnavailable()
        val view = if (projection == "token-references") {
            ComponentConfigView.TOKEN_REFERENCES
        } else {
            ComponentConfigView.FULL
        }
        val result = useCases.projectedConfig(
            ComponentProjectedConfigReadCommand(
                ComponentConfigReadCommand(name, arguments.optional("style")),
                selection,
                view,
            ),
            runtimeRequest(arguments),
        )
        return@with if (result is ComponentReadResult.Failed &&
            result.code == ComponentReadErrorCode.INVALID_SELECTION
        ) {
            invalidArgument(result.message)
        } else {
            result.toMcpResult()
        }
    }
}

internal fun String.toComponentPackageName(): String? =
    removePrefix("components.").takeIf { it.isNotBlank() && it != this }
