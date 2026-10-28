package com.dsbuilder.ds.themes.domain.colortokens

import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.palette.PaletteReference
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull

/**
 * Форма значения цветового токена: вид (цвет или градиент), структура слоёв iOS и Android, хранимая форма
 * сплошного значения платформы (строка) и форма для чтения по типу семейства (слой `color` у `gradient`).
 * Существование ступеней палитры здесь не проверяется — это делает [TokenValueRule].
 */
object ColorValueShape {
    private val HEX = Regex("""^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$""")
    private const val KIND = "kind"
    private const val COLOR_KIND = "color"
    private const val BACKGROUND = "background"
    private const val MIN_STOPS = 2

    private val COMMON_FIELDS = listOf("locations", "colors")
    private val IOS_FIELDS = mapOf(
        "linear" to listOf("angle"),
        "radial" to listOf("centerX", "centerY", "startRadius", "endRadius"),
        "angular" to listOf("startAngle", "endAngle", "centerX", "centerY"),
    )
    private val ANDROID_FIELDS = mapOf(
        "linear" to listOf("angle"),
        "radial" to listOf("centerX", "centerY", "radius"),
        "angular" to listOf("centerX", "centerY"),
    )
    private val UNIT_FIELDS = setOf("centerX", "centerY")
    private val RADIUS_FIELDS = setOf("startRadius", "endRadius", "radius")

    /** Вид значения [value] на платформе [platform] или `null`, если значение не цвет и не градиент. */
    fun kind(platform: ThemeTokenPlatform, value: JsonElement?): ColorValueKind? = when {
        value == null -> null
        solidColor(platform, value) != null -> ColorValueKind.COLOR
        platform == ThemeTokenPlatform.WEB -> ColorValueKind.GRADIENT.takeIf { webGradient(value) }
        else -> ColorValueKind.GRADIENT.takeIf {
            nativeLayerViolation(platform, value) == null && (value as JsonArray).any { !it.isColorLayer() }
        }
    }

    /**
     * Строка цвета сплошного значения — HEX или ссылка: строка, массив из одной строки, а для iOS и Android ещё и
     * `[{ "kind": "color", "background": <цвет> }]`; `null`, если значение не сплошной цвет.
     */
    fun solidColor(platform: ThemeTokenPlatform, value: JsonElement?): String? {
        val raw = singleString(value) ?: if (platform == ThemeTokenPlatform.WEB) {
            null
        } else {
            ((value as? JsonArray)?.singleOrNull() as? JsonObject)?.takeIf { it.isColorLayer() }?.string(BACKGROUND)
        }
        return raw?.takeIf(::isColorString)
    }

    /** Является ли [raw] HEX `#RGB`, `#RRGGBB`, `#RRGGBBAA` или ссылкой `[type.shade.step][o]` по форме. */
    fun isColorString(raw: String): Boolean = HEX.matches(raw) || PaletteReference.parse(raw) != null

    /** Является ли [raw] HEX `#RGB`, `#RRGGBB` или `#RRGGBBAA`. */
    fun isHex(raw: String): Boolean = HEX.matches(raw)

    /**
     * Причина отказа для массива слоёв iOS или Android [value] или `null`, если у каждого слоя есть `kind` и все поля
     * своего вида, `colors` и `locations` одной длины не меньше двух, `locations` не убывают от 0 до 1, центр от 0
     * до 1, радиусы не меньше 0, а цвета — HEX или ссылки.
     */
    fun nativeLayerViolation(platform: ThemeTokenPlatform, value: JsonElement?): String? {
        val fields = if (platform == ThemeTokenPlatform.IOS) IOS_FIELDS else ANDROID_FIELDS
        val layers = (value as? JsonArray)?.takeIf { it.isNotEmpty() }
            ?: return "Значение ${platform.wireValue} — непустой массив слоёв"
        return layers.withIndex().firstNotNullOfOrNull { (index, layer) ->
            (layer as? JsonObject)?.let { layerViolation(it, fields) }?.let { "Слой ${index + 1}: $it" }
                ?: if (layer !is JsonObject) "Слой ${index + 1} — объект с полем kind" else null
        }
    }

    /** Хранимая форма: слой `[{ "kind": "color", "background": <цвет> }]` iOS и Android становится `[<цвет>]`. */
    fun storedForm(platform: ThemeTokenPlatform, value: JsonElement): JsonElement {
        if (platform == ThemeTokenPlatform.WEB || singleString(value) != null) return value
        return solidColor(platform, value)?.let { JsonArray(listOf(JsonPrimitive(it))) } ?: value
    }

    /**
     * Форма для чтения: у семейства типа `gradient` сплошное значение iOS и Android — строка или массив из одной
     * строки — отдаётся слоем `[{ "kind": "color", "background": <цвет> }]`; остальные значения не меняются.
     */
    fun publishedForm(platform: ThemeTokenPlatform, value: JsonElement, type: ThemeTokenType): JsonElement {
        if (type != ThemeTokenType.GRADIENT || platform == ThemeTokenPlatform.WEB) return value
        val color = singleString(value)?.takeIf(::isColorString) ?: return value
        return JsonArray(
            listOf(JsonObject(mapOf(KIND to JsonPrimitive(COLOR_KIND), BACKGROUND to JsonPrimitive(color)))),
        )
    }

    private fun webGradient(value: JsonElement): Boolean {
        val layers = (value as? JsonArray)?.map { singleString(it) ?: return false } ?: return false
        return layers.any { WebGradientGrammar.parse(it) != null } &&
            layers.all { WebGradientGrammar.parse(it) != null || isColorString(it) }
    }

    @Suppress("ReturnCount")
    private fun layerViolation(layer: JsonObject, fields: Map<String, List<String>>): String? {
        val kind = layer.string(KIND) ?: return "нет поля kind"
        if (kind == COLOR_KIND) {
            val background = layer.string(BACKGROUND) ?: return "у слоя color нет background"
            return if (isColorString(background)) null else "background — HEX или ссылка на ступень палитры"
        }
        val own = fields[kind] ?: return "неизвестный вид слоя $kind"
        (COMMON_FIELDS + own).firstOrNull { it !in layer }?.let { return "у слоя $kind нет поля $it" }
        return stopsViolation(layer) ?: numericViolation(layer, own)
    }

    @Suppress("ReturnCount")
    private fun stopsViolation(layer: JsonObject): String? {
        val locations = (layer["locations"] as? JsonArray)?.map { it.number() ?: return "locations — числа" }
            ?: return "locations — массив чисел"
        val colors = (layer["colors"] as? JsonArray)?.map { it.text() ?: return "colors — строки цветов" }
            ?: return "colors — массив цветов"
        return when {
            locations.size < MIN_STOPS || locations.size != colors.size ->
                "colors и locations одной длины не меньше двух"
            locations.any { it !in 0.0..1.0 } || locations.zipWithNext().any { (a, b) -> a > b } ->
                "locations не убывают и лежат от 0 до 1"
            colors.any { !isColorString(it) } -> "colors — HEX или ссылки на ступени палитры"
            else -> null
        }
    }

    private fun numericViolation(layer: JsonObject, fields: List<String>): String? =
        fields.firstNotNullOfOrNull { field ->
            val number = layer[field]?.number()
            when {
                number == null -> "$field — число"
                field in UNIT_FIELDS && number !in 0.0..1.0 -> "$field от 0 до 1"
                field in RADIUS_FIELDS && number < 0.0 -> "$field не меньше 0"
                else -> null
            }
        }

    private fun JsonElement.isColorLayer(): Boolean = (this as? JsonObject)?.string(KIND) == COLOR_KIND

    private fun JsonObject.string(key: String): String? = this[key]?.text()

    private fun JsonElement.text(): String? = (this as? JsonPrimitive)?.takeIf(JsonPrimitive::isString)?.content

    private fun JsonElement.number(): Double? = (this as? JsonPrimitive)?.takeUnless(
        JsonPrimitive::isString,
    )?.doubleOrNull

    private fun singleString(value: JsonElement?): String? = when (value) {
        is JsonPrimitive -> value.text()
        is JsonArray -> value.singleOrNull()?.text()
        else -> null
    }
}
