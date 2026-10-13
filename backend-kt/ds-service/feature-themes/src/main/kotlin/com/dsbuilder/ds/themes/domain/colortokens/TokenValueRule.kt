package com.dsbuilder.ds.themes.domain.colortokens

import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.palette.PaletteRampRef
import com.dsbuilder.ds.themes.domain.palette.PaletteReference
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull

/**
 * Проверка значений цветовых и градиентных токенов при записи. [template] — копия шаблона палитры темы:
 * ссылка `[type.shade.step]` допустима, только если такая ступень в ней есть.
 */
class TokenValueRule(private val template: Map<PaletteRampRef, Map<Int, String>>) {
    /**
     * Причина отказа для значения [value] токена типа [type] на платформе [platform] или `null`, если значение
     * допустимо. [hasPaletteId] — значение задано ссылкой `palette_id` на общую палитру.
     */
    fun validate(
        type: ThemeTokenType,
        platform: ThemeTokenPlatform,
        hasPaletteId: Boolean,
        value: JsonElement,
    ): String? = when (type) {
        ThemeTokenType.COLOR -> if (hasPaletteId) paletteIdValue(value) else colorValue(value)
        ThemeTokenType.GRADIENT ->
            if (platform == ThemeTokenPlatform.WEB) gradientValue(value) else platformGradient(value)
        else -> null
    }

    @Suppress("ReturnCount")
    private fun colorValue(value: JsonElement): String? {
        val raw = singleString(value) ?: return "Цвет должен быть строкой или массивом из одной строки"
        if (HEX.matches(raw)) return null
        val reference = PaletteReference.parse(raw)
            ?: return "Введите цвет в формате Hex (#RGB, #RRGGBB, #RRGGBBAA) или ссылку на ступень палитры: $raw"
        return if (template[reference.ramp]?.containsKey(reference.step) == true) {
            null
        } else {
            "Ступени ${reference.ramp.key}.${reference.step} нет в палитре темы"
        }
    }

    private fun paletteIdValue(value: JsonElement): String? {
        val opacity = when (value) {
            JsonNull -> return null
            is JsonArray -> when (value.size) {
                0 -> return null
                1 -> (value.single() as? JsonPrimitive)?.let { it.doubleOrNull ?: it.content.toDoubleOrNull() }
                else -> null
            }
            else -> null
        }
        return if (opacity != null && opacity in 0.0..1.0) null else "Прозрачность ссылки на палитру — число от 0 до 1"
    }

    private fun gradientValue(value: JsonElement): String? {
        val layers = (value as? JsonArray)?.map { (it as? JsonPrimitive)?.takeIf(JsonPrimitive::isString)?.content }
        val valid = !layers.isNullOrEmpty() && layers.all { it != null && (GRADIENT.matches(it) || HEX.matches(it)) }
        return if (valid) null else "Градиент web — массив CSS-градиентов или цветов в формате Hex"
    }

    private fun platformGradient(value: JsonElement): String? =
        if (value is JsonArray) null else "Градиент ios и android — массив"

    private fun singleString(value: JsonElement): String? = when (value) {
        is JsonPrimitive -> value.takeIf(JsonPrimitive::isString)?.content
        is JsonArray -> (value.singleOrNull() as? JsonPrimitive)?.takeIf(JsonPrimitive::isString)?.content
        else -> null
    }

    private companion object {
        val HEX = Regex("""^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$""")
        val GRADIENT = Regex("""^(?:linear|radial|conic)-gradient\(.+\)$""", RegexOption.DOT_MATCHES_ALL)
    }
}
