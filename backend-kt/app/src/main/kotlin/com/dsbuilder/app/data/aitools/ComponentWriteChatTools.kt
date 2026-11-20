package com.dsbuilder.app.data.aitools

import com.dsbuilder.ai.chat.domain.ToolResult
import com.dsbuilder.ds.components.application.AddAppearanceAxisValueUseCase
import com.dsbuilder.ds.components.application.AppearanceEditorRepository
import com.dsbuilder.ds.components.application.DuplicateAppearanceConfigurationUseCase
import com.dsbuilder.ds.components.application.RemoveAppearancePropertyValueUseCase
import com.dsbuilder.ds.components.application.SetAppearancePropertyValueUseCase
import com.dsbuilder.ds.components.domain.Appearance
import com.dsbuilder.ds.components.domain.EditorAxisValue
import com.dsbuilder.ds.components.domain.EditorPropertyValue
import com.dsbuilder.ds.components.presentation.AppearanceResponse
import com.dsbuilder.ds.components.presentation.EditorAxisValueResponse
import com.dsbuilder.ds.components.presentation.EditorPropertyValueResponse
import com.dsbuilder.ds.components.presentation.SetAppearancePropertyValueRequest
import com.dsbuilder.ds.components.presentation.StyleReferenceRequest
import com.dsbuilder.ds.core.application.withIdempotentResponse
import com.dsbuilder.ds.core.presentation.OkResponse
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.koin.core.Koin
import com.dsbuilder.ds.components.presentation.toCommand as toPropertyCommand

private const val MAX_NAME_LENGTH = 255

/** Обработчики записи компонентов. */
internal fun componentWriteChatTools(koin: Koin): List<DsChatTool> = listOf(
    ComponentPropertySetChatTool(koin.get()),
    ComponentAxisValueCreateChatTool(koin.get()),
    ComponentConfigurationDuplicateChatTool(koin.get()),
    ComponentPropertyResetChatTool(koin.get()),
)

/**
 * `component_property_set`: как `PUT /design-systems/{id}/appearances/{appearanceId}/property-values`.
 * Повтор через контекст: операция `ai:component_property_set|appearance:{id}|property:{propertyId}`, тело — JSON
 * тела запроса маршрута.
 */
private class ComponentPropertySetChatTool(private val set: SetAppearancePropertyValueUseCase) : DsChatTool {
    override val name = "component_property_set"

    @Suppress("ReturnCount")
    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult {
        val id = arguments.text("appearanceId").toUuid() ?: return call.invalidArgument("invalid_id")
        val baseRevision = arguments.baseRevision() ?: return call.invalidArgument("invalid_base_revision")
        val request = arguments.propertyValueRequest() ?: return call.invalidArgument("invalid_body")
        val command = request.toPropertyCommand() ?: return call.invalidArgument("invalid_body")
        val context = call.writeContext(
            scope = "appearance:$id|property:${command.scope.propertyId}",
            body = encodeComponentResponse(SetAppearancePropertyValueRequest.serializer(), request),
            encode = { value: EditorPropertyValue -> propertyValueJson(value).toString() },
            baseRevision = baseRevision.value,
        )
        return call.respond(::propertyValueJson) { set.execute(context, id, command) }
    }
}

/**
 * `component_axis_value_create`: как `POST /design-systems/{id}/appearances/{appearanceId}/axes/{axisId}/values`.
 * Повтор внутри use case (`modelCreate`): ключ хода передаётся параметром, кодировщик ответа — как у маршрута.
 */
private class ComponentAxisValueCreateChatTool(private val add: AddAppearanceAxisValueUseCase) : DsChatTool {
    override val name = "component_axis_value_create"

    @Suppress("ReturnCount")
    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult {
        val id = arguments.text("appearanceId").toUuid() ?: return call.invalidArgument("invalid_id")
        val axisId = arguments.text("axisId").toUuid() ?: return call.invalidArgument("invalid_id")
        val name = arguments.text("name")?.takeIf { it.isNotBlank() && it.length <= MAX_NAME_LENGTH }
        val position = arguments.componentLong("position")
        val validPosition = position == null || position in Int.MIN_VALUE..Int.MAX_VALUE
        if (name == null || !validPosition) return call.invalidArgument("invalid_body")
        val command = AppearanceEditorRepository.AxisValueCreate(name, position?.toInt())
        val context = call.createContext().withIdempotentResponse { value: EditorAxisValue ->
            componentToolJson.encodeToString(EditorAxisValueResponse.serializer(), EditorAxisValueResponse.from(value))
        }
        return call.respond(
            { value ->
                encodeComponentResponse(EditorAxisValueResponse.serializer(), EditorAxisValueResponse.from(value))
            },
        ) { add.execute(context, id, axisId, command, call.createKey) }
    }
}

/**
 * `component_configuration_duplicate`: как `POST /design-systems/{id}/appearances/{appearanceId}/duplicate`.
 * Повтор внутри use case (`modelCreate`): ключ хода передаётся параметром, кодировщик ответа — как у маршрута.
 */
private class ComponentConfigurationDuplicateChatTool(
    private val duplicate: DuplicateAppearanceConfigurationUseCase,
) : DsChatTool {
    override val name = "component_configuration_duplicate"

    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult {
        val id = arguments.text("appearanceId").toUuid() ?: return call.invalidArgument("invalid_id")
        val name = arguments.text("name")?.trim()?.takeIf { it.isNotEmpty() }
        if ((name?.length ?: 0) > MAX_NAME_LENGTH) return call.invalidArgument("invalid_body")
        val context = call.createContext().withIdempotentResponse { value: Appearance ->
            componentToolJson.encodeToString(AppearanceResponse.serializer(), AppearanceResponse.from(value))
        }
        return call.respond(
            { value ->
                encodeComponentResponse(AppearanceResponse.serializer(), AppearanceResponse.from(value))
            },
        ) { duplicate.execute(context, id, name, call.createKey) }
    }
}

/**
 * `component_property_reset`: как `DELETE /design-systems/{id}/appearances/{appearanceId}/property-values
 * ?propertyId=…&styleIds=…&states=…`. Повтор через контекст: операция
 * `ai:component_property_reset|appearance:{id}|property:{propertyId}`, тело — JSON области значения.
 */
private class ComponentPropertyResetChatTool(private val remove: RemoveAppearancePropertyValueUseCase) : DsChatTool {
    override val name = "component_property_reset"

    @Suppress("ReturnCount")
    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult {
        val id = arguments.text("appearanceId").toUuid() ?: return call.invalidArgument("invalid_id")
        val baseRevision = arguments.baseRevision() ?: return call.invalidArgument("invalid_base_revision")
        val propertyId = arguments.text("propertyId").toUuid()
            ?: return call.invalidArgument("invalid_property_id")
        val styleIds = arguments.componentTexts("styleIds")?.filter { it.isNotBlank() }?.map { it.toUuid() }
        if (styleIds == null || styleIds.any { it == null }) return call.invalidArgument("invalid_style_ids")
        val states = arguments.componentTexts("states")?.filter { it.isNotBlank() }
            ?: return call.invalidArgument("invalid_body")
        val scope = AppearanceEditorRepository.PropertyValueScope(propertyId, styleIds.filterNotNull(), states)
        val context = call.writeContext(
            scope = "appearance:$id|property:$propertyId",
            body = buildJsonObject {
                put("propertyId", propertyId.toString())
                put("styleIds", JsonArray(scope.styleIds.map { JsonPrimitive(it.toString()) }))
                put("states", JsonArray(scope.states.map(::JsonPrimitive)))
            },
            encode = { _: Unit -> okJson().toString() },
            baseRevision = baseRevision.value,
        )
        return call.respond({ _ -> okJson() }) { remove.execute(context, id, scope) }
    }
}

private fun propertyValueJson(value: EditorPropertyValue): JsonElement =
    encodeComponentResponse(EditorPropertyValueResponse.serializer(), EditorPropertyValueResponse.from(value))

private fun okJson(): JsonElement = encodeComponentResponse(OkResponse.serializer(), OkResponse())

/** Ревизия из аргумента: `null` в обёртке — нет ревизии; `null` вместо обёртки — отрицательная, как отказ маршрута. */
@JvmInline
private value class BaseRevision(val value: Long?)

private fun JsonObject.baseRevision(): BaseRevision? {
    val revision = componentLong("baseRevision")
    return if (revision != null && revision < 0) null else BaseRevision(revision)
}

/** Тело запроса маршрута из аргументов модели; `null` — неверная форма вложенных полей. */
@Suppress("ReturnCount")
private fun JsonObject.propertyValueRequest(): SetAppearancePropertyValueRequest? {
    val propertyId = text("propertyId") ?: return null
    val styleIds = componentTexts("styleIds") ?: return null
    val states = componentTexts("states") ?: return null
    val reference = (this["reference"] as? JsonObject)?.let { raw ->
        StyleReferenceRequest(
            raw.text("targetAppearanceId") ?: return null,
            raw.componentTexts("styleIds") ?: return null,
        )
    }
    return SetAppearancePropertyValueRequest(
        propertyId = propertyId,
        styleIds = styleIds,
        states = states,
        type = text("type"),
        tokenId = text("tokenId"),
        value = text("value"),
        alpha = text("alpha"),
        adjustment = text("adjustment"),
        reference = reference,
    )
}
