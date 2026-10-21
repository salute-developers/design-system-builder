package com.dsbuilder.ds.themes.domain.palette

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Цвета слоёв значения тени: у `web` — последняя часть CSS-строки слоя `x y blur spread color`, у `ios` и `android`
 * — поле `color` объекта слоя. Цвет слоя — HEX или ссылка на ступень палитры `[type.shade.step][opacity]`, как у
 * стопов градиента; здесь ищутся и заменяются именно ссылки.
 */
object ShadowLayerColors {
    private val WHITESPACE = Regex("\\s+")

    /** Ссылки на ступени палитры в цветах слоёв значения [value] в порядке слоёв; не тень — пустой список. */
    fun references(value: JsonElement?): List<PaletteReference> =
        (value as? JsonArray).orEmpty().mapNotNull { layer -> color(layer)?.let(PaletteReference::parse) }

    /**
     * Значение [value] с заменёнными ссылками цветов слоёв: [transform] даёт новый цвет ссылки или `null`, чтобы
     * оставить её как есть. Остальные части слоя не меняются.
     */
    fun mapReferences(value: JsonElement, transform: (PaletteReference) -> String?): JsonElement {
        val layers = value as? JsonArray ?: return value
        return JsonArray(
            layers.map { layer ->
                val next = color(layer)?.let(PaletteReference::parse)?.let(transform)
                if (next == null) layer else withColor(layer, next)
            },
        )
    }

    private fun color(layer: JsonElement): String? = when (layer) {
        is JsonPrimitive -> layer.takeIf(JsonPrimitive::isString)?.content?.trim()?.split(WHITESPACE)?.lastOrNull()
        is JsonObject -> (layer["color"] as? JsonPrimitive)?.takeIf(JsonPrimitive::isString)?.content
        else -> null
    }

    private fun withColor(layer: JsonElement, color: String): JsonElement = when (layer) {
        is JsonPrimitive -> {
            val parts = layer.content.trim().split(WHITESPACE)
            JsonPrimitive((parts.dropLast(1) + color).joinToString(" "))
        }
        is JsonObject -> JsonObject(layer + ("color" to JsonPrimitive(color)))
        else -> layer
    }
}
