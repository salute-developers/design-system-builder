package com.dsbuilder.frontend.mcpserver

internal fun readOnlyMcpToolDefinitions(): List<McpToolDefinition> = (
    listOf(
        McpToolDefinition(name = "project_get_status", description = "Verify backend project access."),
        documentationSearchTool(),
        documentationPublicationsListTool(),
        tool("documentation_fetch", "Fetch one published documentation knowledge chunk.", "kbUrl"),
        tool("documentation_get_navigation", "Read publication navigation.", "publicationId", "version", "platform"),
        tool("documentation_get_page", "Read one publication page.", "path", "publicationId", "version", "platform"),
        codeBindingSearchTool(),
        codeBindingGetTool(),
        componentConfigurationsListTool(),
        componentConfigGetTool(),
        componentTokensGetTool(),
    ) + modelMcpTools()
    ).map { definition ->
    definition.copy(
        inputSchema = definition.inputSchema + (
            "designSystem" to stringInput(
                "Optional dsbuilder://projects/{projectId}/design-systems/{designSystemId}" +
                    "?version=... link. The platform query parameter is optional. " +
                    "Selects a resource for this call; it is not an API URL or credential.",
            )
            ),
    )
}

private fun tool(name: String, description: String, vararg inputs: String): McpToolDefinition =
    McpToolDefinition(name = name, description = description, inputSchema = inputs.associateWith { stringInput() })

private fun documentationSearchTool(): McpToolDefinition = McpToolDefinition(
    name = "documentation_search",
    description = "Search published DS Builder documentation. Use limit and subject to narrow results.",
    inputSchema = mapOf(
        "query" to stringInput("Search phrase or technical identifier."),
        "subjects" to stringArrayInput("Optional canonical subject filters."),
        "subject" to stringInput("Legacy single canonical subject filter."),
        "publicationId" to stringInput("Exact published documentation ID for continuing a search."),
        "limit" to McpToolInputDefinition(type = "integer", description = "Maximum number of results."),
        "cursor" to stringInput("Opaque cursor from a previous search page."),
        "version" to stringInput(
            "Exact documentation version. Omit only when the resolved design-system context selects a version.",
        ),
        "platform" to stringInput("Exact publication platform, for example compose."),
    ),
)

private fun documentationPublicationsListTool(): McpToolDefinition = McpToolDefinition(
    name = "documentation_publications_list",
    description = "List published documentation releases and republications for one design system.",
    inputSchema = mapOf(
        "version" to stringInput("Optional exact documentation version."),
        "platform" to stringInput("Optional documentation platform."),
        "limit" to McpToolInputDefinition(type = "integer", description = "Maximum number of publications."),
        "cursor" to stringInput("Cursor from the previous publication page."),
    ),
)

private fun codeBindingSearchTool(): McpToolDefinition = McpToolDefinition(
    name = "code_binding_search",
    description =
    "Search active published code bindings. Returns compact metadata; " +
        "for questions about available published code variations, start here and then call " +
        "code_binding_get with detail=summary. " +
        "Do not call components_list or component_variations_get for that task. " +
        "Use name for a code symbol such as BasicButton. " +
        "Subject and kind are exact filters: a component uses a canonical subject such as " +
        "components.basic-button and kind component-style, not subject BasicButton or kind component.",
    inputSchema = mapOf(
        "subject" to stringInput(
            "Exact canonical documentation subject, for example components.basic-button. " +
                "This is not the code symbol; use name to search for BasicButton.",
        ),
        "kind" to stringInput(
            description =
            "Exact binding kind. Published component APIs use component-style; " +
                "design tokens use token. The value component is not valid.",
            allowedValues = listOf("component-style", "token"),
        ),
        "name" to stringInput(
            "Case-insensitive substring of the code binding name. " +
                "Use this filter for human-readable code symbols such as BasicButton.",
        ),
        "limit" to McpToolInputDefinition(
            type = "integer",
            description = "Maximum number of bindings to return.",
        ),
        "cursor" to stringInput("Opaque cursor returned by a previous search page."),
        "publicationId" to stringInput("Exact published documentation ID; omit to resolve active publication."),
        "version" to stringInput(
            "Exact documentation version. Omit only when the resolved design-system context selects a version.",
        ),
        "platform" to stringInput(
            "Exact publication platform, for example compose. " +
                "Omit to use the platform from the resolved DS Builder context.",
        ),
    ),
)

private fun codeBindingGetTool(): McpToolDefinition = McpToolDefinition(
    name = "code_binding_get",
    description =
    "Read one published code binding. Component bindings return a compact variation summary by default. " +
        "Use this after code_binding_search to answer which published code variations are available; " +
        "components_list and component_variations_get describe the configuration model instead. " +
        "Use detail=variations for concrete code references and detail=full only when the complete " +
        "style API is needed.",
    inputSchema = mapOf(
        "bindingId" to stringInput("Exact binding ID returned by code_binding_search."),
        "publicationId" to stringInput("Exact publication ID. Omit to resolve the active publication."),
        "version" to stringInput(
            "Exact documentation version. Omit only when the resolved design-system context selects a version.",
        ),
        "platform" to stringInput("Exact publication platform, for example compose."),
        "appearanceNames" to stringArrayInput(
            "Optional exact styleName values from platformPayload.styles. Only matching appearances are returned.",
        ),
        "variationNames" to stringArrayInput(
            "Optional exact variation name values. When detail is omitted, this automatically selects " +
                "variations detail.",
        ),
        "detail" to stringInput(
            "Response detail for component bindings: summary returns axes, defaults and counts; " +
                "variations also returns concrete code references; full preserves the complete published payload.",
            allowedValues = listOf("summary", "variations", "full"),
        ),
    ),
)

private fun componentConfigurationsListTool(): McpToolDefinition = McpToolDefinition(
    name = "component_configurations_list",
    description = "List configurations of one component by stable component ID.",
    inputSchema = mapOf(
        "componentId" to stringInput("Component ID returned by components_list."),
        "version" to stringInput("Exact model version or draft."),
        "limit" to McpToolInputDefinition(type = "integer", description = "Maximum number of configurations."),
        "cursor" to stringInput("Cursor from the previous configuration page."),
    ),
)

private fun componentConfigGetTool(): McpToolDefinition = McpToolDefinition(
    name = "component_config_get",
    description =
    "Read effective properties of a component configuration for selected axis value IDs. " +
        "Unselected axes do not contribute properties; an empty selection reads base properties.",
    inputSchema = mapOf(
        "appearanceId" to stringInput("Configuration ID returned by component_configurations_list."),
        "selectedValueIds" to stringArrayInput("Axis value IDs returned by component_variations_get."),
        "version" to stringInput("Exact model version or draft."),
    ),
)

private fun componentTokensGetTool(): McpToolDefinition = McpToolDefinition(
    name = "component_tokens_get",
    description = "Read verified token references for one value on every axis of a configuration.",
    inputSchema = mapOf(
        "appearanceId" to stringInput("Configuration ID returned by component_configurations_list."),
        "selectedValueIds" to stringArrayInput("One selected value ID for every axis."),
        "version" to stringInput("Exact model version or draft."),
    ),
)

private fun stringInput(
    description: String? = null,
    allowedValues: List<String> = emptyList(),
): McpToolInputDefinition = McpToolInputDefinition(description = description, allowedValues = allowedValues)

private fun stringArrayInput(description: String): McpToolInputDefinition =
    McpToolInputDefinition(type = "array", description = description, itemType = "string")
