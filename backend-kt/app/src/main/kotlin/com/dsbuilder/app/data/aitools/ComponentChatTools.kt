package com.dsbuilder.app.data.aitools

import com.dsbuilder.ai.chat.domain.ToolResult
import com.dsbuilder.ds.components.application.GetAppearanceEditorModelUseCase
import com.dsbuilder.ds.components.application.GetComponentPropertiesWithPlatformParamsUseCase
import com.dsbuilder.ds.components.application.GetComponentTokenReferencesUseCase
import com.dsbuilder.ds.components.application.GetResolvedComponentPropertiesUseCase
import com.dsbuilder.ds.components.application.ListAppearanceVariationAxesUseCase
import com.dsbuilder.ds.components.application.ListComponentConfigurationsUseCase
import com.dsbuilder.ds.components.presentation.AppearanceEditorModelResponse
import com.dsbuilder.ds.components.presentation.AppearanceVariationAxisResponse
import com.dsbuilder.ds.components.presentation.ComponentConfigurationsResponse
import com.dsbuilder.ds.components.presentation.ComponentPropertySummaryResponse
import com.dsbuilder.ds.components.presentation.ComponentTokenReferenceResponse
import com.dsbuilder.ds.components.presentation.ComponentTokenReferencesResponse
import com.dsbuilder.ds.components.presentation.EditorPropertyValueResponse
import com.dsbuilder.ds.components.presentation.PropertyPlatformParamResponse
import com.dsbuilder.ds.components.presentation.ResolvedComponentPropertiesResponse
import com.dsbuilder.ds.core.application.ModelReadQuery
import com.dsbuilder.ds.designsystems.application.ListDesignSystemComponentsUseCase
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.presentation.DesignSystemComponentSummaryResponse
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import org.koin.core.Koin
import java.util.UUID

/** Обработчики инструментов чата этой области. */
internal fun componentChatTools(koin: Koin): List<DsChatTool> = listOf(
    ComponentsListChatTool(koin.get()),
    ComponentConfigurationsListChatTool(koin.get()),
    ComponentVariationsChatTool(koin.get()),
    ComponentPropertiesChatTool(koin.get()),
    ComponentEditorChatTool(koin.get()),
    ComponentConfigChatTool(koin.get()),
    ComponentTokensChatTool(koin.get()),
) + componentWriteChatTools(koin)

/** `components_list`: как `GET /design-systems/{id}/components?version=draft` без страницы — весь список. */
private class ComponentsListChatTool(private val list: ListDesignSystemComponentsUseCase) : DsChatTool {
    override val name = "components_list"

    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult {
        val name = arguments.text("name")
        val query = arguments.text("query")
        if (name != null && query != null) return call.invalidArgument("INVALID_QUERY")
        val read = ModelReadQuery(name = name, query = query, platform = arguments.text("platform"))
        return call.respond(
            { value ->
                encodeComponentResponse(
                    ListSerializer(DesignSystemComponentSummaryResponse.serializer()),
                    value.map(DesignSystemComponentSummaryResponse::from),
                )
            },
        ) { list.execute(call.readContext().copy(readQuery = read), DesignSystemId(call.designSystemId), query) }
    }
}

/** `component_configurations_list`: как `GET /design-systems/{id}/appearances?componentId=…&version=draft`. */
private class ComponentConfigurationsListChatTool(
    private val configurations: ListComponentConfigurationsUseCase,
) : DsChatTool {
    override val name = "component_configurations_list"

    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult {
        val componentId = arguments.text("componentId").toUuid()
            ?: return call.invalidArgument("invalid_component_id")
        val cursor = arguments.text("cursor")
        if (cursor == "") return call.invalidArgument("INVALID_QUERY")
        val limit = arguments.componentLong("limit")?.coerceIn(0L, Int.MAX_VALUE.toLong())?.toInt() ?: DEFAULT_LIMIT
        return call.respond(
            { value ->
                encodeComponentResponse(
                    ComponentConfigurationsResponse.serializer(),
                    ComponentConfigurationsResponse.from(value),
                )
            },
        ) { configurations.execute(call.readContext(), call.designSystemId, componentId, limit, cursor) }
    }

    private companion object {
        const val DEFAULT_LIMIT = 20
    }
}

/** `component_variations_get`: как `GET /design-systems/{id}/appearances/{appearanceId}/variations?version=draft`. */
private class ComponentVariationsChatTool(private val axes: ListAppearanceVariationAxesUseCase) : DsChatTool {
    override val name = "component_variations_get"

    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult {
        val id = arguments.text("appearanceId").toUuid() ?: return call.invalidArgument("invalid_id")
        return call.respond(
            { value ->
                encodeComponentResponse(
                    ListSerializer(AppearanceVariationAxisResponse.serializer()),
                    value.map(AppearanceVariationAxisResponse::from),
                )
            },
        ) { axes.execute(call.readContext(), id) }
    }
}

/**
 * `component_properties_get`: как `GET /design-systems/{id}/components/{componentId}/properties
 * ?include=platformParams&version=draft`. По умолчанию, как у MCP, остаются только `id`, `name`, `type`,
 * `defaultValue`; `detail = full` отдаёт тело маршрута целиком.
 */
private class ComponentPropertiesChatTool(
    private val properties: GetComponentPropertiesWithPlatformParamsUseCase,
) : DsChatTool {
    override val name = "component_properties_get"

    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult {
        val id = arguments.text("componentId").toUuid() ?: return call.invalidArgument("invalid_id")
        val full = when (arguments.text("detail")) {
            null, "compact" -> false
            "full" -> true
            else -> return call.invalidArgument("invalid_detail")
        }
        return call.respond(
            { value ->
                val body = encodeComponentResponse(
                    ListSerializer(ComponentPropertySummaryResponse.serializer()),
                    value.map {
                        ComponentPropertySummaryResponse.from(
                            it.property,
                            it.platformParams.map(PropertyPlatformParamResponse::from),
                        )
                    },
                )
                if (full) body else JsonArray((body as JsonArray).map { (it as JsonObject).compactProperty() })
            },
        ) { properties.execute(call.readContext(), id, call.designSystemId) }
    }

    private fun JsonObject.compactProperty() = JsonObject(filterKeys { it in COMPACT_FIELDS })

    private companion object {
        val COMPACT_FIELDS = setOf("id", "name", "type", "defaultValue")
    }
}

/** `component_editor_get`: как `GET /design-systems/{id}/appearances/{appearanceId}/editor-model`. */
private class ComponentEditorChatTool(private val model: GetAppearanceEditorModelUseCase) : DsChatTool {
    override val name = "component_editor_get"

    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult {
        val id = arguments.text("appearanceId").toUuid() ?: return call.invalidArgument("invalid_id")
        return call.respond(
            { value ->
                encodeComponentResponse(
                    AppearanceEditorModelResponse.serializer(),
                    AppearanceEditorModelResponse.from(value),
                )
            },
        ) { model.execute(call.readContext(), id) }
    }
}

/** `component_config_get`: как `GET /design-systems/{id}/appearances/{appearanceId}/resolved-properties`. */
private class ComponentConfigChatTool(private val resolved: GetResolvedComponentPropertiesUseCase) : DsChatTool {
    override val name = "component_config_get"

    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult {
        val id = arguments.text("appearanceId").toUuid() ?: return call.invalidArgument("invalid_id")
        val valueIds = arguments.selectedValueIds() ?: return call.invalidArgument("invalid_selected_value_id")
        return call.respond(
            { value ->
                encodeComponentResponse(
                    ResolvedComponentPropertiesResponse.serializer(),
                    ResolvedComponentPropertiesResponse(
                        id.toString(),
                        valueIds.map(UUID::toString),
                        value.map(EditorPropertyValueResponse::from),
                    ),
                )
            },
        ) { resolved.execute(call.readContext(), id, valueIds) }
    }
}

/** `component_tokens_get`: как `GET /design-systems/{id}/appearances/{appearanceId}/token-references`. */
private class ComponentTokensChatTool(private val references: GetComponentTokenReferencesUseCase) : DsChatTool {
    override val name = "component_tokens_get"

    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult {
        val id = arguments.text("appearanceId").toUuid() ?: return call.invalidArgument("invalid_id")
        val valueIds = arguments.selectedValueIds() ?: return call.invalidArgument("invalid_selected_value_id")
        return call.respond(
            { value ->
                encodeComponentResponse(
                    ComponentTokenReferencesResponse.serializer(),
                    ComponentTokenReferencesResponse(value.map(ComponentTokenReferenceResponse::from)),
                )
            },
        ) { references.execute(call.readContext(), id, valueIds) }
    }
}

/** Выбранные значения осей; `null` — если хотя бы один ID не UUID, как у маршрута. */
private fun JsonObject.selectedValueIds(): List<UUID>? {
    val raw = componentTexts("selectedValueIds") ?: return null
    val ids = raw.map { it.toUuid() }
    return ids.takeIf { values -> values.none { it == null } }?.filterNotNull()
}
