package com.dsbuilder.app.data.aitools

import com.dsbuilder.ai.chat.domain.ToolResult
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.ModelReadQuery
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
internal fun JsonObject.text(name: String): String? =
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

/** UUID из строки, как `toUuidOrNull` маршрутов ds-service. */
internal fun String?.toUuid(): UUID? = this?.let { runCatching { UUID.fromString(it) }.getOrNull() }

/** Отказ разбора аргументов тем же кодом, что у маршрута (`400` с [code]), без вызова use case. */
internal fun DsToolCall.invalidArgument(code: String): ToolResult =
    reject(DsFailure.InvalidRequest(code))

/** Кодирует ответ маршрута в JSON; строковая форма совпадает с телом HTTP-ответа. */
internal fun <T> encodeComponentResponse(
    serializer: kotlinx.serialization.KSerializer<T>,
    value: T,
): JsonElement = componentToolJson.encodeToJsonElement(serializer, value)

/** Размер страницы и продолжение; `null` — недопустимые значения, как `INVALID_QUERY` маршрута. */
internal fun JsonObject.page(): ModelReadQuery? {
    val limit = (this["limit"] as? JsonPrimitive)?.longOrNull ?: DEFAULT_LIMIT.toLong()
    val cursor = text("cursor")
    if (limit !in 1..MAX_LIMIT || cursor == "") return null
    return ModelReadQuery(limit = limit.toInt(), cursor = cursor)
}

/** UUID из строкового аргумента. */
internal fun JsonObject.uuid(name: String): UUID? = text(name)?.toUuid()

private const val DEFAULT_LIMIT = 50
private const val MAX_LIMIT = 200L
