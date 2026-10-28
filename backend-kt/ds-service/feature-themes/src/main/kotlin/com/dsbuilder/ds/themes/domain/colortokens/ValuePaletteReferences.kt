package com.dsbuilder.ds.themes.domain.colortokens

import com.dsbuilder.ds.themes.domain.palette.PaletteReference
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Ссылки на палитру внутри значения: всё значение-строка, цвет стопа web-градиента, элементы `colors` и `background`
 * слоёв iOS и Android. Ссылка `palette_id` сюда не входит — её разбирает хранилище палитры.
 */
object ValuePaletteReferences {
    private val REFERENCE = Regex("""\[(?:general|additional)\.[A-Za-z0-9]+\.\d+](?:\[\d+(?:\.\d+)?])?""")

    /** Все ссылки значения [value] в порядке записи, с повторами. */
    fun find(value: JsonElement?): List<PaletteReference> = when (value) {
        is JsonPrimitive -> value.text()?.let { text ->
            REFERENCE.findAll(text).mapNotNull { PaletteReference.parse(it.value) }.toList()
        }.orEmpty()
        is JsonArray -> value.flatMap(::find)
        is JsonObject -> value.values.flatMap(::find)
        else -> emptyList()
    }

    /**
     * Значение [value], в котором каждая ссылка заменена строкой [transform]; `null` из [transform] оставляет ссылку
     * как есть. Остальной текст, позиции, угол и центр не меняются.
     */
    fun rewrite(value: JsonElement, transform: (PaletteReference) -> String?): JsonElement = when (value) {
        is JsonPrimitive -> value.text()?.let { text ->
            JsonPrimitive(
                REFERENCE.replace(text) { match ->
                    PaletteReference.parse(match.value)?.let(transform) ?: match.value
                },
            )
        }?.takeIf { it.content != value.content } ?: value
        is JsonArray -> JsonArray(value.map { rewrite(it, transform) })
        is JsonObject -> JsonObject(value.mapValues { (_, item) -> rewrite(item, transform) })
        else -> value
    }

    private fun JsonPrimitive.text(): String? = takeIf(JsonPrimitive::isString)?.content
}
