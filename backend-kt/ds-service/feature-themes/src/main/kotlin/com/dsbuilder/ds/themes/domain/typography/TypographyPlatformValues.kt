package com.dsbuilder.ds.themes.domain.typography

import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive
import java.math.BigDecimal
import kotlin.math.abs

/**
 * Перевод значений стиля между единицами редактора (px, em, вес числом) и форматом платформ.
 * Значение токена в базе — массив из одного объекта; остальные поля объекта сохраняются.
 */
object TypographyPlatformValues {
    /** Префикс ссылки на семейство шрифта. */
    const val FONT_FAMILY_PREFIX = "fontFamily."

    /** Число px в одном rem на вебе. */
    private val REM = BigDecimal(16)

    /** Слова веса iOS по числу; порядок 100 `thin`, 200 `ultraLight` — как в разборе токенов плагина. */
    val IOS_WEIGHTS: Map<Int, String> = mapOf(
        100 to "thin",
        200 to "ultraLight",
        300 to "light",
        400 to "regular",
        500 to "medium",
        600 to "semibold",
        700 to "bold",
        800 to "heavy",
        900 to "black",
    )

    private val CSS_WEIGHTS = mapOf("normal" to 400, "bold" to 700)

    /** Объект значения токена: первый элемент массива или сам объект; иначе пустой объект. */
    fun objectOf(value: JsonElement?): JsonObject = when (value) {
        is JsonObject -> value
        is JsonArray -> value.firstOrNull() as? JsonObject ?: JsonObject(emptyMap())
        else -> JsonObject(emptyMap())
    }

    /**
     * Значения токена в единицах редактора. Источник — значение `web`; если его нет или поле не разобрано,
     * берётся `android`, затем `ios`.
     */
    fun read(values: Map<ThemeTokenPlatform, JsonElement>): TypographyMetrics {
        val web = objectOf(values[ThemeTokenPlatform.WEB])
        val android = objectOf(values[ThemeTokenPlatform.ANDROID])
        val ios = objectOf(values[ThemeTokenPlatform.IOS])
        return TypographyMetrics(
            sizePx = web.length("fontSize") ?: android.number("textSize") ?: ios.number("size") ?: 0.0,
            lineHeightPx = web.length("lineHeight") ?: android.number("lineHeight") ?: ios.number("lineHeight") ?: 0.0,
            letterSpacingEm = web.letterSpacing() ?: android.number("letterSpacing") ?: ios.number("kerning") ?: 0.0,
            weight = web.cssWeight() ?: android.number("fontWeight")?.toInt() ?: ios.iosWeight() ?: DEFAULT_WEIGHT,
            fontFamily = sequenceOf(web, android, ios)
                .mapNotNull { it.text("fontFamilyRef") }
                .firstOrNull()
                ?.removePrefix(FONT_FAMILY_PREFIX)
                .orEmpty(),
        )
    }

    /** Новое значение платформы [platform] с изменением [change]; формат хранения — массив из одного объекта. */
    fun write(current: JsonElement?, platform: ThemeTokenPlatform, change: TypographyTokenChange): JsonElement {
        val fields = objectOf(current).toMutableMap()
        val format = FORMATS.getValue(platform)
        change.sizePx?.let { fields[format.size] = format.length(it) }
        change.lineHeightPx?.let { fields[format.lineHeight] = format.length(it) }
        change.letterSpacingEm?.let { fields[format.letterSpacing] = format.spacing(it) }
        change.weight?.let(format.weightValue)?.let { fields[format.weight] = it }
        change.fontFamily?.let { fields["fontFamilyRef"] = JsonPrimitive(FONT_FAMILY_PREFIX + it) }
        return JsonArray(listOf(JsonObject(fields)))
    }

    /** `px / 16` в rem без лишних нулей: `18` → `1.125rem`. */
    fun rem(px: Double): String = decimal(BigDecimal.valueOf(px).divide(REM)) + "rem"

    /** Трекинг на вебе: ноль — `normal`, иначе `<em>em`. */
    fun em(value: Double): String = if (value == 0.0) "normal" else decimal(BigDecimal.valueOf(value)) + "em"

    private fun decimal(value: BigDecimal): String =
        value.stripTrailingZeros().toPlainString().let { if (it == "-0") "0" else it }

    /** Число для `android` и `ios`: целое без дробной части. */
    private fun number(value: Double): JsonPrimitive =
        if (value % 1.0 == 0.0 && abs(value) < Int.MAX_VALUE) JsonPrimitive(value.toInt()) else JsonPrimitive(value)

    private fun JsonObject.text(name: String): String? = (get(name) as? JsonPrimitive)?.contentOrNull

    private fun JsonObject.number(name: String): Double? = (get(name) as? JsonPrimitive)?.let { primitive ->
        primitive.doubleOrNull ?: primitive.contentOrNull?.toDoubleOrNull()
    }

    /** Длина на вебе в px: `1.25rem` → 20, `20px` → 20, `20` → 20. */
    private fun JsonObject.length(name: String): Double? {
        val raw = text(name)?.trim() ?: return null
        return when {
            raw.endsWith("rem") -> raw.removeSuffix("rem").toBigDecimalOrNull()?.multiply(REM)?.toDouble()
            raw.endsWith("px") -> raw.removeSuffix("px").toDoubleOrNull()
            else -> raw.toDoubleOrNull()
        }
    }

    /** Трекинг на вебе в em: `normal` → 0, `-0.02em` → −0.02. */
    private fun JsonObject.letterSpacing(): Double? {
        val raw = text("letterSpacing")?.trim() ?: return null
        return if (raw == "normal") 0.0 else raw.removeSuffix("em").toDoubleOrNull()
    }

    private fun JsonObject.cssWeight(): Int? {
        val raw = text("fontWeight")?.trim() ?: return null
        return CSS_WEIGHTS[raw] ?: raw.toIntOrNull()
    }

    private fun JsonObject.iosWeight(): Int? {
        val word = text("weight") ?: return null
        return IOS_WEIGHTS.entries.firstOrNull { it.value.equals(word, ignoreCase = true) }?.key
            ?: (get("weight") as? JsonPrimitive)?.jsonPrimitive?.intOrNull
    }

    private const val DEFAULT_WEIGHT = 400

    /** Поля и формат значения платформы. */
    private class PlatformFormat(
        val size: String,
        val letterSpacing: String,
        val weight: String,
        val length: (Double) -> JsonPrimitive,
        val spacing: (Double) -> JsonPrimitive,
        val weightValue: (Int) -> JsonPrimitive?,
    ) {
        val lineHeight = "lineHeight"
    }

    private val FORMATS = mapOf(
        ThemeTokenPlatform.WEB to PlatformFormat(
            size = "fontSize",
            letterSpacing = "letterSpacing",
            weight = "fontWeight",
            length = { JsonPrimitive(rem(it)) },
            spacing = { JsonPrimitive(em(it)) },
            weightValue = { JsonPrimitive(it.toString()) },
        ),
        ThemeTokenPlatform.ANDROID to PlatformFormat(
            size = "textSize",
            letterSpacing = "letterSpacing",
            weight = "fontWeight",
            length = ::number,
            spacing = ::number,
            weightValue = { JsonPrimitive(it) },
        ),
        ThemeTokenPlatform.IOS to PlatformFormat(
            size = "size",
            letterSpacing = "kerning",
            weight = "weight",
            length = ::number,
            spacing = ::number,
            weightValue = { weight -> IOS_WEIGHTS[weight]?.let(::JsonPrimitive) },
        ),
    )
}
