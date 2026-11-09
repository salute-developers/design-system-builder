package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.feature.ds.application.DiscoverDesignSystemVersionsCommand
import com.dsbuilder.frontend.feature.ds.application.DiscoverDesignSystemVersionsUseCase
import com.dsbuilder.frontend.feature.ds.application.ModelReadCommand
import com.dsbuilder.frontend.feature.ds.application.ModelReadOperation
import com.dsbuilder.frontend.feature.ds.application.ModelReadResult
import com.dsbuilder.frontend.feature.ds.application.ReadDesignSystemModelUseCase
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** Выполняет чтение модели по схемам MCP-инструментов. */
internal class ModelMcpTools(
    private val useCase: ReadDesignSystemModelUseCase?,
    private val context: McpReadToolContext,
    private val discovery: DiscoverDesignSystemVersionsUseCase?,
    private val apiUrlOverride: String?,
) {
    suspend fun read(name: String, arguments: JsonObject): McpToolResult = with(context) {
        val operation = modelToolOperations.getValue(name)
        val schema = modelMcpTools().single { it.name == name }.inputSchema
        val argumentError = modelArgumentError(arguments, schema)
        if (argumentError != null) return@with toolError("INVALID_QUERY", argumentError)
        if (operation == ModelReadOperation.VERSIONS && ("projectId" in arguments || "designSystemId" in arguments)) {
            return@with discover(arguments)
        }
        val idName = modelResourceArgument(operation)
        val id = idName?.let { arguments.required(it) }
        if (idName != null && id == null) return@with toolError("INVALID_QUERY", "$idName is required")
        val reader = useCase ?: return@with backendReaderUnavailable()
        val excluded = setOf("designSystem", "version", "limit", "cursor", "detail", idName)
        val filters = arguments.filterKeys { it !in excluded }
            .mapValues { (_, value) -> (value as JsonPrimitive).content }
        when (
            val result = reader.execute(
                ModelReadCommand(
                    operation,
                    id,
                    arguments.optional("version"),
                    filters,
                    arguments.optional("limit")?.toIntOrNull(),
                    arguments.optional("cursor"),
                ),
                runtimeRequest(arguments),
            )
        ) {
            is ModelReadResult.Success -> success(
                if (operation == ModelReadOperation.COMPONENT_PROPERTIES && arguments.optional("detail") != "full") {
                    compactComponentProperties(result.value).toString()
                } else {
                    result.value.toString()
                },
            )
            is ModelReadResult.Failed -> toolError(result.code, result.message)
        }
    }

    private suspend fun discover(arguments: JsonObject): McpToolResult = with(context) {
        val project = arguments.required("projectId")
        val system = arguments.required("designSystemId")
        if (project == null || system == null || "designSystem" in arguments) {
            return@with toolError("INVALID_QUERY", "Supply both projectId and designSystemId without designSystem URI.")
        }
        val reader = discovery ?: return@with backendReaderUnavailable()
        when (
            val result = reader.execute(
                DiscoverDesignSystemVersionsCommand(
                    project,
                    system,
                    arguments.optional("limit")?.toIntOrNull(),
                    arguments.optional("cursor"),
                ),
                apiUrlOverride,
            )
        ) {
            is ModelReadResult.Failed -> toolError(result.code, result.message)
            is ModelReadResult.Success -> success(result.value.toString())
        }
    }

    private fun modelArgumentError(arguments: JsonObject, schema: Map<String, McpToolInputDefinition>): String? {
        val error = inputObjectError(arguments, schema + ("designSystem" to McpToolInputDefinition()))
        if (error != null) return error
        val limit = arguments["limit"] as? JsonPrimitive
        return if (limit != null && limit.content.toIntOrNull() == null) "Invalid model read argument: limit" else null
    }
}

private fun compactComponentProperties(value: JsonElement): JsonElement {
    val envelope = value as? JsonObject ?: return value
    val properties = envelope["data"] as? JsonArray ?: return value
    val propertyFields = setOf("id", "name", "type", "defaultValue")
    val compact = JsonArray(
        properties.map { property ->
            val item = property as? JsonObject ?: return@map property
            JsonObject(item.filterKeys { it in propertyFields })
        },
    )
    return JsonObject(envelope + ("data" to compact))
}

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
    "component_properties_get" to ModelReadOperation.COMPONENT_PROPERTIES,
    "component_dependencies_get" to ModelReadOperation.COMPONENT_DEPENDENCIES,
)

internal fun modelMcpTools(): List<McpToolDefinition> = modelToolOperations.map { (name, operation) ->
    val properties = linkedMapOf<String, McpToolInputDefinition>()
    if (operation != ModelReadOperation.COMPONENT && operation != ModelReadOperation.VERSIONS) {
        properties["version"] = McpToolInputDefinition(
            description = "Exact major.minor.patch or draft. Explicit value overrides the selected context version; " +
                "without either, reads the draft. The result reports the actual selected version.",
        )
    }
    if (operation == ModelReadOperation.VERSIONS) {
        properties["projectId"] = McpToolInputDefinition(
            description = "Project ID; requires designSystemId, excludes URI.",
        )
        properties["designSystemId"] = McpToolInputDefinition(
            description = "System ID from design_systems_list; requires projectId.",
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
    if (operation == ModelReadOperation.COMPONENT_PROPERTIES) {
        properties["detail"] = McpToolInputDefinition(
            description = "compact (default) returns IDs, names, types and default values; " +
                "full includes platform parameters and metadata.",
            allowedValues = listOf("compact", "full"),
        )
    }
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
        val description = when (it) {
            "name" -> "Exact case-sensitive resource name; cannot be combined with query."
            "query" -> "Case-insensitive substring search; cannot be combined with name."
            "groupId" -> "Stable token-group ID returned by token_groups_list."
            "parentId" -> "Return only immediate children of this token-group ID."
            "tenantId" -> "Stable theme ID returned by tenants_list."
            "shade" -> "Exact palette shade filter."
            else -> "Optional server filter: $it."
        }
        properties[it] = McpToolInputDefinition(description = description)
    }
    if (operation == ModelReadOperation.TOKEN_VALUES) {
        properties["mode"] = McpToolInputDefinition(
            description = "Exact theme mode: light or dark. Omit to return both modes.",
            allowedValues = listOf("light", "dark"),
        )
        properties["platform"] = McpToolInputDefinition(
            description = "Model platform; use android for Compose. Omit to return all platforms.",
            allowedValues = listOf("web", "android", "ios"),
        )
    }
    if (operation == ModelReadOperation.COMPONENTS) {
        properties["platform"] = McpToolInputDefinition(
            description = "Component implementation platform; compose and xml are separate Android targets.",
            allowedValues = listOf("web", "compose", "xml", "ios"),
        )
    }
    if (operation == ModelReadOperation.TOKENS) {
        properties["type"] = McpToolInputDefinition(
            description = "Exact token family; use color or gradient for palette-related tokens.",
            allowedValues = listOf("color", "gradient", "typography", "fontFamily", "spacing", "shape", "shadow"),
        )
    }
    if (operation == ModelReadOperation.TOKEN_GROUPS) {
        properties["kind"] = McpToolInputDefinition(
            description = "Token-group tree kind; currently only color is available.",
            allowedValues = listOf("color"),
        )
    }
    if (operation == ModelReadOperation.PALETTE) {
        properties["type"] = McpToolInputDefinition(
            description = "Palette ramp type: general or additional.",
            allowedValues = listOf("general", "additional"),
        )
    }
}

private fun modelDescription(name: String, operation: ModelReadOperation): String =
    MODEL_DESCRIPTIONS.getValue(operation).replace("{tool}", name)

private const val MODEL_DESCRIPTION_0 =
    "List published model versions with server cursor pagination. Without context, first call projects_list, " +
        "then design_systems_list(projectId), then pass both projectId and designSystemId here. " +
        "Use each returned designSystem URI in subsequent reads. " +
        "User session required; run dsbuilder auth login. " +
        "Alternatively retain existing URI/workspace calls. No global selection is stored."
private const val MODEL_DESCRIPTION_1 =
    "List token groups and subgroups in tree position order with server cursor pagination. " +
        "Use a group ID to filter tokens_list or palette_get."
private const val MODEL_DESCRIPTION_2 =
    "List authoritative model data through {tool}. Filters and cursor pagination are applied by the server. " +
        "An explicit version overrides the selected context version; without either, reads the draft."
private const val MODEL_DESCRIPTION_3 =
    "Read authoritative model data through {tool}. This is one resource read, not a paged list. " +
        "An explicit version overrides the selected context version; without either, reads the draft."
private const val MODEL_DESCRIPTION_4 =
    "Read current component metadata by " +
        "componentId without selecting a configuration."
private const val MODEL_DESCRIPTION_5 =
    "Read axes, declared values and defaults of one versioned configuration by appearanceId. " +
        "First call components_list, then component_configurations_list; pass this tool's value IDs to " +
        "component_config_get. No default configuration is selected. For published " +
        "code variations use code_binding_search and code_binding_get."
private const val MODEL_DESCRIPTION_6 =
    "Read actual design-system context and safe local connection settings."
private const val MODEL_DESCRIPTION_7 =
    "Read one exact published model version or the draft; this is not a paged list."

private val MODEL_DESCRIPTIONS = mapOf(
    ModelReadOperation.VERSIONS to MODEL_DESCRIPTION_0,
    ModelReadOperation.TOKEN_GROUPS to MODEL_DESCRIPTION_1,
    ModelReadOperation.CHANGES to MODEL_DESCRIPTION_2,
    ModelReadOperation.TENANTS to MODEL_DESCRIPTION_2,
    ModelReadOperation.TOKENS to MODEL_DESCRIPTION_2,
    ModelReadOperation.COMPONENTS to MODEL_DESCRIPTION_2,
    ModelReadOperation.COMPONENT_STYLES to MODEL_DESCRIPTION_2,
    ModelReadOperation.TOKEN to MODEL_DESCRIPTION_3,
    ModelReadOperation.TOKEN_VALUES to MODEL_DESCRIPTION_3,
    ModelReadOperation.PALETTE to MODEL_DESCRIPTION_3,
    ModelReadOperation.COMPONENT_PROPERTIES to MODEL_DESCRIPTION_3,
    ModelReadOperation.COMPONENT_DEPENDENCIES to MODEL_DESCRIPTION_3,
    ModelReadOperation.COMPONENT to MODEL_DESCRIPTION_4,
    ModelReadOperation.APPEARANCE_VARIATIONS to MODEL_DESCRIPTION_5,
    ModelReadOperation.CONTEXT to MODEL_DESCRIPTION_6,
    ModelReadOperation.VERSION to MODEL_DESCRIPTION_7,
)

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
    ModelReadOperation.COMPONENT_PROPERTIES to "componentId",
    ModelReadOperation.COMPONENT_DEPENDENCIES to "componentId",
)

internal fun modelResourceArgument(operation: ModelReadOperation): String? = modelResourceArguments[operation]
