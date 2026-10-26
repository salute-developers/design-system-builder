package com.dsbuilder.frontend.mcpserver

internal fun readOnlyMcpToolDefinitions(): List<McpToolDefinition> = (
    listOf(
        McpToolDefinition(name = "project_get_status", description = "Verify backend project access."),
        documentationSearchTool(),
        tool("documentation_fetch", "Fetch one published documentation knowledge chunk.", "kbUrl"),
        tool("documentation_get_navigation", "Read active publication navigation.", "version", "platform"),
        tool("documentation_get_page", "Read one active publication page.", "path", "version", "platform"),
        codeBindingSearchTool(),
        codeBindingGetTool(),
        componentConfigGetTool(),
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
        "subject" to stringInput("Optional canonical subject filter, for example components.basic-button."),
        "limit" to McpToolInputDefinition(type = "integer", description = "Maximum number of results."),
        "cursor" to stringInput("Opaque cursor from a previous search page."),
        "version" to stringInput(
            "Exact documentation version. Omit only when the resolved design-system context selects a version.",
        ),
        "platform" to stringInput("Exact publication platform, for example compose."),
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

private fun componentConfigGetTool(): McpToolDefinition = McpToolDefinition(
    name = "component_config_get",
    description =
    "Read the authoritative common component configuration containing token references. " +
        "To continue from a component CodeBinding, pass its canonical subject, for example " +
        "components.basic-button. A Compose reference such as BasicButton.S.Accent " +
        "is not a component style name: " +
        "S and Accent are variation values. Use selection=size=s,view=accent to narrow the response. " +
        "Omit selection and projection to retrieve the unchanged full package.",
    inputSchema = mapOf(
        "subject" to stringInput(
            "Canonical component CodeBinding subject, for example components.basic-button. " +
                "Preferred when continuing from code_binding_search or code_binding_get.",
        ),
        "name" to stringInput(
            "Exact componentName from the exported common-config package, for example basic-button. " +
                "This is not the Compose symbol BasicButton.",
        ),
        "style" to stringInput(
            "Optional exact styleName (product appearance) from the exported package, for example basic-button. " +
                "Do not pass a generated Compose reference or variation combination such as S.Accent; " +
                "omit this filter when the styleName is unknown.",
        ),
        "selection" to stringInput(
            "Comma-separated variation IDs and exact values, for example size=s,view=accent. " +
                "Unknown IDs or values are errors. Unselected axes remain in the full projection.",
        ),
        "projection" to stringInput(
            "full preserves selected config structure; token-references returns only names verified against the " +
                "authoritative token catalog. It requires values for every variation axis " +
                "and does not resolve token values.",
            allowedValues = listOf("full", "token-references"),
        ),
    ),
)

private fun stringInput(
    description: String? = null,
    allowedValues: List<String> = emptyList(),
): McpToolInputDefinition = McpToolInputDefinition(description = description, allowedValues = allowedValues)

private fun stringArrayInput(description: String): McpToolInputDefinition =
    McpToolInputDefinition(type = "array", description = description, itemType = "string")
