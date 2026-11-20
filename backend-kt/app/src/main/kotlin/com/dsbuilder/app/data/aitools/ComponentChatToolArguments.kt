package com.dsbuilder.app.data.aitools

import com.dsbuilder.ai.chat.domain.ToolResult
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.longOrNull
import java.util.UUID

/** Тот же формат, что у маршрутов ds-service в монолите: `explicitNulls = true`, умолчания не пишутся. */
internal val componentToolJson = Json { explicitNulls = true }

/** Строковый аргумент; отсутствие и `null` — `null`. Нестроковое значение отсекает проверка схемы каталога. */
internal fun JsonObject.componentText(name: String): String? =
    (get(name) as? JsonPrimitive)?.takeIf { it.isString }?.content

/** Целочисленный аргумент; отсутствие и `null` — `null`. */
internal fun JsonObject.componentLong(name: String): Long? =
    (get(name) as? JsonPrimitive)?.takeIf { !it.isString }?.longOrNull

/** Массив строк; отсутствие и `null` — пустой список, элемент не строка — `null`. */
internal fun JsonObject.componentTexts(name: String): List<String>? = when (val raw = get(name)) {
    null, JsonNull -> emptyList()
    is JsonArray -> raw.map { (it as? JsonPrimitive)?.takeIf { item -> item.isString }?.content }
        .takeIf { items -> items.none { it == null } }
        ?.filterNotNull()
    else -> null
}

/** Объектный аргумент; отсутствие и `null` — `null`. */
internal fun JsonObject.componentObject(name: String): JsonObject? = get(name) as? JsonObject

/** UUID из строки, как `toUuidOrNull` маршрутов ds-service. */
internal fun String?.componentUuid(): UUID? = this?.let { runCatching { UUID.fromString(it) }.getOrNull() }

/** Отказ разбора аргументов тем же кодом, что у маршрута (`400` с [code]), без вызова use case. */
internal suspend fun DsToolCall.invalidArgument(code: String): ToolResult =
    respond<Unit>({ JsonNull }) { DsResult.Failure(DsFailure.InvalidRequest(code)) }

/** Кодирует ответ маршрута в JSON; строковая форма совпадает с телом HTTP-ответа. */
internal fun <T> encodeComponentResponse(
    serializer: kotlinx.serialization.KSerializer<T>,
    value: T,
): JsonElement = componentToolJson.encodeToJsonElement(serializer, value)
