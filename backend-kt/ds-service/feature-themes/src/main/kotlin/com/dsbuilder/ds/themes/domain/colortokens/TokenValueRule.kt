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
 * Проверка значений цветовых и градиентных токенов при записи по виду значения. [template] — копия шаблона палитры
 * темы: ссылка `[type.shade.step]` допустима, только если такая ступень в ней есть, в том числе в стопе градиента.
 */
class TokenValueRule(private val template: Map<PaletteRampRef, Map<Int, String>>) {
    /**
     * Причина отказа для значения [value] токена типа [type] на платформе [platform] или `null`, если значение
     * допустимо: у типа `color` — только цвет, у типа `gradient` — цвет или градиент. Так проверяет пакетная запись
     * `PUT token-values`. [hasPaletteId] — значение задано ссылкой `palette_id` на общую палитру.
     */
    fun validate(
        type: ThemeTokenType,
        platform: ThemeTokenPlatform,
        hasPaletteId: Boolean,
        value: JsonElement,
    ): String? = when (type) {
        ThemeTokenType.COLOR -> when {
            hasPaletteId -> paletteIdValue(value)
            ColorValueShape.kind(platform, value) == ColorValueKind.GRADIENT ->
                "Градиент допустим только у градиентного токена; вид значения меняют операции цветового токена"
            else -> colorValue(platform, value)
        }
        ThemeTokenType.GRADIENT -> validateColorToken(platform, hasPaletteId, value)
        else -> null
    }

    /**
     * Причина отказа для значения операции цветового токена: любой член семейства принимает и цвет, и градиент,
     * тип семейства затем вычисляется по значениям.
     */
    fun validateColorToken(platform: ThemeTokenPlatform, hasPaletteId: Boolean, value: JsonElement): String? = when {
        hasPaletteId -> paletteIdValue(value)
        ColorValueShape.solidColor(platform, value) != null -> colorValue(platform, value)
        platform == ThemeTokenPlatform.WEB -> webGradient(value)
        else -> nativeGradient(platform, value)
    }

    private fun colorValue(platform: ThemeTokenPlatform, value: JsonElement): String? {
        val raw = ColorValueShape.solidColor(platform, value)
            ?: return if (platform == ThemeTokenPlatform.WEB) {
                "Цвет должен быть строкой или массивом из одной строки"
            } else {
                "Цвет ${platform.wireValue} — строка, массив из одной строки или слой color"
            }
        return colorString(raw)
    }

    private fun colorString(raw: String): String? {
        if (ColorValueShape.isHex(raw)) return null
        val reference = PaletteReference.parse(raw)
            ?: return "Введите цвет в формате Hex (#RGB, #RRGGBB, #RRGGBBAA) или ссылку на ступень палитры: $raw"
        return missingStep(reference)
    }

    private fun missingStep(reference: PaletteReference): String? =
        if (template[reference.ramp]?.containsKey(reference.step) == true) {
            null
        } else {
            "Ступени ${reference.ramp.key}.${reference.step} нет в палитре темы"
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

    @Suppress("ReturnCount")
    private fun webGradient(value: JsonElement): String? {
        val layers = (value as? JsonArray)?.map { (it as? JsonPrimitive)?.takeIf(JsonPrimitive::isString)?.content }
        if (layers.isNullOrEmpty() || layers.any { it == null }) {
            return "Значение web — цвет или массив строк-слоёв градиента"
        }
        var gradient = false
        for (layer in layers.filterNotNull()) {
            if (WebGradientGrammar.isFunction(layer)) {
                val parsed = WebGradientGrammar.parse(layer) ?: return "Градиент не соответствует формату: $layer"
                gradient = true
                parsed.stops.firstNotNullOfOrNull { (it.color as? StopColor.Ref)?.reference?.let(::missingStep) }
                    ?.let { return it }
            } else {
                colorString(layer)?.let { return it }
            }
        }
        return if (gradient) null else "Значение web — цвет или градиент с градиентной функцией"
    }

    private fun nativeGradient(platform: ThemeTokenPlatform, value: JsonElement): String? {
        ColorValueShape.nativeLayerViolation(platform, value)?.let { return it }
        if (ColorValueShape.kind(platform, value) != ColorValueKind.GRADIENT) {
            return "Значение ${platform.wireValue} — цвет или градиент хотя бы с одним слоем не color"
        }
        return ValuePaletteReferences.find(value).firstNotNullOfOrNull(::missingStep)
    }
}
