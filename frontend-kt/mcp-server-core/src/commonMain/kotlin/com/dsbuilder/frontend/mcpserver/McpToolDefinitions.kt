package com.dsbuilder.frontend.mcpserver

internal fun readOnlyMcpToolDefinitions(): List<McpToolDefinition> = listOf(
    McpToolDefinition(
        name = "design_system_get_context",
        description = "Return resolved DS Builder project and design-system context.",
    ),
    McpToolDefinition(
        name = "project_get_status",
        description = "Verify backend access for the resolved DS Builder project.",
    ),
    documentationSearchTool(),
    tool("documentation_fetch", "Fetch one published documentation knowledge chunk.", "kbUrl"),
    tool("documentation_get_navigation", "Read active publication navigation.", "version", "platform"),
    tool("documentation_get_page", "Read one active publication page.", "path", "version", "platform"),
    codeBindingSearchTool(),
    codeBindingGetTool(),
    tokensListTool(),
    tool("token_get", "Read one authoritative design-system token by stable ID.", "tokenId"),
    tokenValuesGetTool(),
    componentsListTool(),
    tool("component_get", "Read one authoritative design-system component by stable ID.", "componentId"),
    componentConfigGetTool(),
    tool("component_styles_get", "Read authoritative component styles by stable component ID.", "componentId"),
    tool(
        "component_variations_get",
        "Read authoritative configuration-model variations by stable component ID. " +
            "Do not use this tool to list published code variations; " +
            "use code_binding_search followed by code_binding_get with detail=summary instead.",
        "componentId",
    ),
).map { definition ->
    definition.copy(
        inputSchema = definition.inputSchema + (
            "designSystem" to stringInput(
                "Optional dsbuilder://projects/{projectId}/design-systems/{designSystemId}" +
                    "?version=...&platform=... link. " +
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

private fun tokenValuesGetTool(): McpToolDefinition = McpToolDefinition(
    name = "token_values_get",
    description =
    "Read authoritative light or dark values for a token resolved to a stable ID with tokens_list. " +
        "Compose uses the android model platform; omit platform to return all platform rows.",
    inputSchema = mapOf(
        "tokenId" to stringInput("Stable token model UUID returned by tokens_list."),
        "tenantId" to stringInput("Optional tenant UUID from the resolved design-system context."),
        "mode" to stringInput("Theme mode.", allowedValues = listOf("light", "dark")),
        "platform" to stringInput(
            "Design-system model platform. Use android for Compose; compose is not valid here. " +
                "Omit to return web, ios, and android rows.",
            allowedValues = listOf("web", "android", "ios"),
        ),
    ),
)

private fun tokensListTool(): McpToolDefinition = McpToolDefinition(
    name = "tokens_list",
    description =
    "Search the authoritative token catalog by token metadata. This tool does not search component usage: " +
        "queries such as BasicButton or button may be empty even when the component uses tokens. " +
        "Read component_config_get first, then look up the exact token names found in its properties and use the " +
        "returned stable IDs with token_get or token_values_get.",
    inputSchema = mapOf(
        "type" to stringInput(
            "Optional exact token type.",
            allowedValues = listOf("color", "gradient", "typography", "fontFamily", "spacing", "shape", "shadow"),
        ),
        "name" to stringInput(
            "Optional exact token name. It is sent through the existing backend query and checked exactly by MCP. " +
                "Do not combine with query.",
        ),
        "query" to stringInput("Substring matched against token metadata, not component-to-token dependencies."),
        "limit" to McpToolInputDefinition(type = "integer", description = "Maximum number of tokens to return."),
    ),
)

private fun componentsListTool(): McpToolDefinition = McpToolDefinition(
    name = "components_list",
    description =
    "Search authoritative design-system component metadata. Returns compact summaries; use component_get for the " +
        "full component DTO. Do not use this tool to discover published code variations; " +
        "use code_binding_search followed by code_binding_get with detail=summary instead.",
    inputSchema = mapOf(
        "name" to stringInput(
            "Optional exact component name. It is sent through the existing backend query and checked exactly by " +
                "MCP. Do not combine with query.",
        ),
        "query" to stringInput("Substring matched against component name and description."),
        "platform" to stringInput("Optional target platform retained for the component-list contract."),
        "limit" to McpToolInputDefinition(type = "integer", description = "Maximum number of components to return."),
    ),
)

private fun stringInput(
    description: String? = null,
    allowedValues: List<String> = emptyList(),
): McpToolInputDefinition = McpToolInputDefinition(description = description, allowedValues = allowedValues)

private fun stringArrayInput(description: String): McpToolInputDefinition =
    McpToolInputDefinition(type = "array", description = description, itemType = "string")
