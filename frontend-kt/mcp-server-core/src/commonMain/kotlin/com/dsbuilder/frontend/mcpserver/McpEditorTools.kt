package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.core.application.DraftEditOptions
import com.dsbuilder.frontend.core.network.editorCommandJson
import com.dsbuilder.frontend.feature.components.application.ComponentEditCommand
import com.dsbuilder.frontend.feature.components.application.EditComponentUseCase
import com.dsbuilder.frontend.feature.theme.application.EditThemeUseCase
import com.dsbuilder.frontend.feature.theme.application.EditTokenUseCase
import com.dsbuilder.frontend.feature.theme.application.ReadTokenEditDataUseCase
import com.dsbuilder.frontend.feature.theme.application.ThemeEditCommand
import com.dsbuilder.frontend.feature.theme.application.TokenEditCommand
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.longOrNull

/** Проверяет закрытые схемы и передаёт только типизированные команды прикладным сценариям. */
internal class McpEditorTools(
    private val tokens: EditTokenUseCase?,
    private val themes: EditThemeUseCase?,
    private val tokenData: ReadTokenEditDataUseCase?,
    private val components: EditComponentUseCase?,
    private val context: McpReadToolContext,
) {
    private val definitions = editorMcpToolDefinitions().associateBy { it.name }

    suspend fun call(name: String, arguments: JsonObject): McpToolResult {
        val definition = definitions.getValue(name)
        val version = arguments.text("version")
        if (version != null && version != "draft") {
            return editorError("READ_ONLY_VERSION", "Editor operations require draft.")
        }
        val error = inputObjectError(arguments, definition.inputSchema)
        val blank = arguments.entries.firstOrNull { (key, value) ->
            definition.inputSchema[key]?.required == true &&
                value is JsonPrimitive && value.isString && value.content.isBlank()
        }
        val invalid = error ?: blank?.let { "Required non-blank field: ${it.key}" }
        if (invalid != null) return editorError("VALIDATION_FAILED", invalid)
        return try {
            dispatch(name, arguments).withCreatedConfigurationId(name)
        } catch (exception: IllegalArgumentException) {
            editorError("VALIDATION_FAILED", "Invalid editor parameters.")
        }
    }

    private suspend fun dispatch(name: String, arguments: JsonObject): McpToolResult {
        val request = context.runtimeRequest(arguments)
        val options = DraftEditOptions(
            arguments.text("idempotencyKey").orEmpty(),
            arguments.text("version"),
            arguments.number("baseRevision"),
        )
        return when {
            name == "token_edit_data_get" -> tokenData?.execute(
                arguments.string("tokenId"),
                arguments.string("tenantId"),
                options.version,
                request,
            )?.toEditorMcpResult() ?: unavailable()
            name == "component_editor_get" -> components?.read(
                arguments.string("appearanceId"),
                options.version,
                request,
            )?.toEditorMcpResult() ?: unavailable()
            name in pointNames -> tokens?.execute(
                decodeCommand<TokenEditCommand>(name, arguments),
                options,
                request,
            )?.toEditorMcpResult() ?: unavailable()
            name in themeNames -> themes?.execute(
                decodeCommand<ThemeEditCommand>(name, arguments, themeRoutes.getValue(name)),
                options,
                request,
            )?.toEditorMcpResult() ?: unavailable()
            else -> components?.execute(
                decodeCommand<ComponentEditCommand>(name, arguments, componentRoutes[name]),
                options,
                request,
            )?.toEditorMcpResult() ?: unavailable()
        }
    }

    private fun unavailable(): McpToolResult = editorError("BACKEND_UNAVAILABLE", "Editor tools are not configured.")
}

private val pointNames = setOf(
    "token_create",
    "token_update",
    "token_delete",
    "token_value_create",
    "token_value_update",
    "token_value_delete",
)
private val themeNames = editorTokenTools.map { it.name }.toSet() - pointNames
private val editorOptionFields = setOf("designSystem", "version", "idempotencyKey", "baseRevision")
private val themeRoutes = mapOf(
    "color_token_create" to setOf("tenantId"),
    "color_token_values_update" to setOf("tenantId", "tokenId"),
    "color_token_move" to setOf("tenantId", "tokenId"),
    "color_token_delete" to setOf("tenantId", "tokenId"),
    "token_group_create" to setOf("tenantId"),
    "token_group_update" to setOf("tenantId", "groupId"),
    "token_group_delete" to setOf("tenantId", "groupId"),
    "size_token_value_update" to setOf("tenantId", "tokenId"),
    "typography_style_update" to setOf("tenantId", "tokenId"),
)
private val componentRoutes = mapOf(
    "component_axis_create" to setOf("appearanceId"),
    "component_axis_value_create" to setOf("appearanceId", "axisId"),
    "component_property_set" to setOf("appearanceId"),
    "component_states_reorder" to setOf("appearanceId"),
)

private inline fun <reified T> decodeCommand(
    name: String,
    args: JsonObject,
    routeFields: Set<String>? = null,
): T {
    val fields = args.filterKeys { it !in editorOptionFields }
    val payload = if (routeFields == null) {
        fields
    } else {
        fields.filterKeys { it in routeFields } +
            ("input" to JsonObject(fields.filterKeys { it !in routeFields }))
    }
    return editorCommandJson.decodeFromJsonElement(JsonObject(payload + ("operation" to JsonPrimitive(name))))
}

private fun JsonObject.text(name: String): String? = (get(name) as? JsonPrimitive)?.takeIf { it.isString }?.content
private fun JsonObject.string(
    name: String,
): String = text(name)?.takeIf { it.isNotBlank() } ?: error("Missing validated field $name")
private fun JsonObject.number(name: String): Long? = (get(name) as? JsonPrimitive)?.longOrNull

private fun McpToolResult.withCreatedConfigurationId(name: String): McpToolResult {
    val creation = name == "component_configuration_create" || name == "component_configuration_duplicate"
    if (isError || !creation) return this
    val envelope = parseEditorJson(body) as? JsonObject ?: return this
    val data = envelope["data"] as? JsonObject
    val id = data?.get("id")
    val result = if (data != null && id != null) {
        JsonObject(envelope + ("data" to JsonObject(data + ("appearanceId" to id))))
    } else {
        envelope
    }
    return copy(body = result.toString())
}
