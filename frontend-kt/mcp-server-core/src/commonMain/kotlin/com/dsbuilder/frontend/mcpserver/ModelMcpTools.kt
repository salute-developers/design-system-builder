package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.feature.ds.application.ModelReadOperation

internal val modelToolOperations = linkedMapOf(
    "design_system_get_context" to ModelReadOperation.CONTEXT,
    "design_system_versions_list" to ModelReadOperation.VERSIONS,
    "design_system_version_get" to ModelReadOperation.VERSION,
    "design_system_changes_list" to ModelReadOperation.CHANGES,
    "tenants_list" to ModelReadOperation.TENANTS,
    "tokens_list" to ModelReadOperation.TOKENS,
    "token_get" to ModelReadOperation.TOKEN,
    "token_values_get" to ModelReadOperation.TOKEN_VALUES,
    "token_groups_list" to ModelReadOperation.TOKEN_GROUPS,
    "palette_get" to ModelReadOperation.PALETTE,
    "components_list" to ModelReadOperation.COMPONENTS,
    "component_get" to ModelReadOperation.COMPONENT,
    "component_styles_get" to ModelReadOperation.COMPONENT_STYLES,
    "component_variations_get" to ModelReadOperation.APPEARANCE_VARIATIONS,
)

internal fun modelMcpTools(): List<McpToolDefinition> = modelToolOperations.map { (name, operation) ->
    val properties = linkedMapOf<String, McpToolInputDefinition>()
    if (operation != ModelReadOperation.COMPONENT && operation != ModelReadOperation.VERSIONS) {
        properties["version"] = McpToolInputDefinition(
            description = "Exact major.minor.patch or " +
                "draft; overrides URI version.",
        )
    }
    val id = modelResourceArgument(operation)
    if (id != null) {
        properties[id] = McpToolInputDefinition(
            description = "Required stable model UUID.",
            required = true,
        )
    }
    addModelFilters(operation, properties)
    if (operation in pagedModelOperations) {
        properties["limit"] = McpToolInputDefinition(type = "integer", description = "Page size 1..200; default 50.")
        properties["cursor"] = McpToolInputDefinition(description = "Opaque continuation returned by this list.")
    }
    McpToolDefinition(name, modelDescription(name, operation), properties)
}

private val modelFilters = mapOf(
    ModelReadOperation.TENANTS to listOf("name", "query"),
    ModelReadOperation.TOKENS to listOf("type", "name", "query", "groupId"),
    ModelReadOperation.TOKEN_VALUES to listOf("tenantId", "mode", "platform"),
    ModelReadOperation.TOKEN_GROUPS to listOf("kind", "parentId"),
    ModelReadOperation.PALETTE to listOf("groupId", "type", "shade"),
    ModelReadOperation.COMPONENTS to listOf("name", "query", "platform"),
    ModelReadOperation.COMPONENT_STYLES to listOf("name"),
)

private fun addModelFilters(
    operation: ModelReadOperation,
    properties: MutableMap<String, McpToolInputDefinition>,
) {
    modelFilters[operation].orEmpty().forEach {
        properties[it] = McpToolInputDefinition(description = "Optional server filter: $it.")
    }
    if (operation == ModelReadOperation.TOKEN_VALUES) {
        properties["mode"] = McpToolInputDefinition(allowedValues = listOf("light", "dark"))
        properties["platform"] = McpToolInputDefinition(
            description = "Model platform; use android for Compose. Omit to return all platforms.",
            allowedValues = listOf("web", "android", "ios"),
        )
    }
    if (operation == ModelReadOperation.COMPONENTS) {
        properties["platform"] = McpToolInputDefinition(allowedValues = listOf("web", "compose", "xml", "ios"))
    }
    if (operation == ModelReadOperation.TOKENS) {
        properties["type"] = McpToolInputDefinition(
            allowedValues = listOf("color", "gradient", "typography", "fontFamily", "spacing", "shape", "shadow"),
        )
    }
    if (operation == ModelReadOperation.TOKEN_GROUPS) {
        properties["kind"] = McpToolInputDefinition(allowedValues = listOf("color"))
    }
    if (operation == ModelReadOperation.PALETTE) {
        properties["type"] = McpToolInputDefinition(allowedValues = listOf("general", "additional"))
    }
}

private fun modelDescription(name: String, operation: ModelReadOperation): String = when (operation) {
    ModelReadOperation.COMPONENT ->
        "Read current component metadata by " +
            "componentId without selecting a configuration."
    ModelReadOperation.APPEARANCE_VARIATIONS ->
        "Read axes, declared values and defaults of one versioned configuration by appearanceId. " +
            "No default configuration is selected. For published " +
            "code variations use code_binding_search and code_binding_get."
    ModelReadOperation.CONTEXT -> "Read actual design-system context and safe local connection settings."
    else -> "Read authoritative model data through $name; filtering and pagination are performed by the server."
}

internal val pagedModelOperations = setOf(
    ModelReadOperation.VERSIONS,
    ModelReadOperation.CHANGES,
    ModelReadOperation.TENANTS,
    ModelReadOperation.TOKENS,
    ModelReadOperation.TOKEN_GROUPS,
    ModelReadOperation.COMPONENTS,
    ModelReadOperation.COMPONENT_STYLES,
)

private val modelResourceArguments = mapOf(
    ModelReadOperation.TOKEN to "tokenId",
    ModelReadOperation.TOKEN_VALUES to "tokenId",
    ModelReadOperation.PALETTE to "tenantId",
    ModelReadOperation.COMPONENT to "componentId",
    ModelReadOperation.COMPONENT_STYLES to "componentId",
    ModelReadOperation.APPEARANCE_VARIATIONS to "appearanceId",
)

internal fun modelResourceArgument(operation: ModelReadOperation): String? = modelResourceArguments[operation]
