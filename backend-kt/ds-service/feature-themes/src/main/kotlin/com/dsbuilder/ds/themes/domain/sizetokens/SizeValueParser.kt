package com.dsbuilder.ds.themes.domain.sizetokens

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Проверка и разбор значений токенов размеров по таблице проверок `add-sizes-tokens-editor`: первое нарушение
 * возвращается с полем запроса и текстом для пользователя.
 */
object SizeValueParser {
    /** Поле не заполнено. */
    const val EMPTY = "Значение не может быть пустым."

    /** Поле — не число. */
    const val NOT_NUMBER = "Размер должен быть числом."

    /** Поле — дробное число. */
    const val NOT_INTEGER = "Размер должен быть целым числом."

    /** У тени нет слоёв. */
    const val NO_LAYERS = "У тени должен быть хотя бы один слой."

    /** У тени больше [MAX_LAYERS] слоёв. */
    const val TOO_MANY_LAYERS = "У тени не больше 4 слоёв."

    /** Цвет слоя не `#RRGGBB` и не `#RRGGBBAA`. */
    const val NOT_HEX = "Цвет должен быть в формате Hex."

    /** Наибольшее число слоёв тени. */
    const val MAX_LAYERS = 4

    /** Диапазон радиуса в px. */
    val RADIUS_RANGE: IntRange = 0..1000

    /** Диапазон отступа в px. */
    val SPACING_RANGE: IntRange = 0..128

    /** Диапазон смещений и растяжения слоя тени в px. */
    val OFFSET_RANGE: IntRange = -200..200

    /** Диапазон размытия слоя тени в px. */
    val BLUR_RANGE: IntRange = 0..200

    /** Диапазон запасной высоты Android. */
    val ELEVATION_RANGE: IntRange = 0..24

    private const val DIMENSION_BODY = "Радиус и отступ задаются значением valuePx, а не слоями тени."
    private const val SHADOW_BODY = "Тень задаётся слоями layers, а не значением valuePx."
    private const val VARIANTS_BODY = "Слои нового размера тени задаются в variants."
    private const val PLATFORMS_OBJECT = "Свои значения платформ задаются объектом с ключами ios и android."
    private const val UNKNOWN_PLATFORM = "Своё значение задаётся только для ios и android."
    private const val PLATFORM_LAYERS = "Свои слои платформы задаются объектом с полем layers."
    private const val LAYER_OBJECT = "Слой тени задаётся объектом с полями offsetX, offsetY, blur, spread и color."
    private const val VARIANTS = "Нужны варианты down.soft, down.hard, up.soft и up.hard, каждый по одному разу."
    private val HEX = Regex("^#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$")
    private val LAYER_NUMBERS = listOf(
        "offsetX" to OFFSET_RANGE,
        "offsetY" to OFFSET_RANGE,
        "blur" to BLUR_RANGE,
        "spread" to OFFSET_RANGE,
    )

    /** Новое значение токена раздела [kind] из [input]: веб и свои значения платформ. */
    fun parse(kind: SizeTokenKind, input: SizeValueInput): SizeValueCheck<SizeTokenValue> = Reader().run {
        result(if (kind == SizeTokenKind.SHADOW) shadow(input) else dimension(kind, input))
    }

    /** Значения четырёх вариантов нового размера тени из `variants` запроса [input]. */
    fun variants(input: SizeValueInput): SizeValueCheck<List<ShadowVariantValue>> = Reader().run {
        result(variantList(input))
    }

    /** Текст отказа для числа вне диапазона [range]. */
    fun rangeMessage(range: IntRange): String = "Значение должно быть в диапазоне ${range.first}–${range.last} px."

    private fun Reader.dimension(kind: SizeTokenKind, input: SizeValueInput): SizeTokenValue.Dimension? {
        val range = if (kind == SizeTokenKind.RADIUS) RADIUS_RANGE else SPACING_RANGE
        val foreign = listOf("layers" to input.layers, "fallbackElevation" to input.fallbackElevation)
            .plus("variants" to input.variants)
            .firstOrNull { (_, value) -> value.present() }
        if (foreign != null) return fail(foreign.first, DIMENSION_BODY)
        val px = integer("valuePx", input.valuePx, range)
        val platforms = px?.let { platforms(input.platforms) { field, element -> integer(field, element, range) } }
        return platforms?.let { SizeTokenValue.Dimension(requireNotNull(px), it) }
    }

    private fun Reader.shadow(input: SizeValueInput): SizeTokenValue.Shadow? = when {
        input.valuePx.present() -> fail("valuePx", SHADOW_BODY)
        input.variants.present() -> fail("variants", DIMENSION_BODY)
        else -> shadowValue("", input.layers, input.fallbackElevation)?.let { value ->
            platforms(input.platforms) { field, element ->
                (element as? JsonObject)?.let { layers("$field.layers", it["layers"]) } ?: fail(field, PLATFORM_LAYERS)
            }?.let { value.copy(platforms = it) }
        }
    }

    private fun Reader.variantList(input: SizeValueInput): List<ShadowVariantValue>? {
        val items = input.variants as? JsonArray
        return when {
            input.valuePx.present() -> fail("valuePx", SHADOW_BODY)
            input.layers.present() -> fail("layers", VARIANTS_BODY)
            items == null -> fail("variants", VARIANTS)
            else -> items.mapIndexed { index, item -> variant("variants[$index]", item) }
                .takeIf { parsed -> parsed.all { it != null } }
                ?.filterNotNull()
                ?.let { parsed ->
                    val names = parsed.map(ShadowVariantValue::variant)
                    val complete = names.sorted() == SizeTokenNaming.SHADOW_VARIANTS.sorted()
                    if (complete) parsed else fail("variants", VARIANTS)
                }
        }
    }

    private fun Reader.variant(field: String, item: JsonElement): ShadowVariantValue? {
        val variant = item as? JsonObject ?: return fail(field, VARIANTS)
        val name = (variant["variant"] as? JsonPrimitive)?.takeIf(JsonPrimitive::isString)?.content
            ?.takeIf { it in SizeTokenNaming.SHADOW_VARIANTS }
            ?: return fail("$field.variant", VARIANTS)
        return shadowValue("$field.", variant["layers"], variant["fallbackElevation"])
            ?.let { ShadowVariantValue(name, it) }
    }

    private fun Reader.shadowValue(
        prefix: String,
        layers: JsonElement?,
        elevation: JsonElement?,
    ): SizeTokenValue.Shadow? {
        val parsed = layers("${prefix}layers", layers) ?: return null
        val fallback = if (elevation.present()) integer("${prefix}fallbackElevation", elevation, ELEVATION_RANGE) else 0
        return fallback?.let { SizeTokenValue.Shadow(parsed, it) }
    }

    private fun Reader.layers(field: String, element: JsonElement?): List<ShadowLayer>? {
        val items = element as? JsonArray
        return when {
            items.isNullOrEmpty() -> fail(field, NO_LAYERS)
            items.size > MAX_LAYERS -> fail(field, TOO_MANY_LAYERS)
            else -> items.mapIndexed { index, item -> layer("$field[$index]", item) }
                .takeIf { parsed -> parsed.all { it != null } }
                ?.filterNotNull()
        }
    }

    private fun Reader.layer(field: String, item: JsonElement): ShadowLayer? {
        val layer = item as? JsonObject ?: return fail(field, LAYER_OBJECT)
        val numbers = LAYER_NUMBERS.map { (name, range) -> integer("$field.$name", layer[name], range) }
        val color = (layer["color"] as? JsonPrimitive)?.takeIf(JsonPrimitive::isString)?.content?.trim()
            ?.takeIf(HEX::matches)
            ?: fail("$field.color", NOT_HEX)
        if (color == null || numbers.any { it == null }) return null
        return SizePlatformValues.layer(numbers.filterNotNull(), color)
    }

    private fun <T> Reader.platforms(
        element: JsonElement?,
        read: Reader.(String, JsonElement) -> T?,
    ): Map<NativePlatform, T>? {
        if (!element.present()) return emptyMap()
        val values = element as? JsonObject ?: return fail("platforms", PLATFORMS_OBJECT)
        val parsed = values.entries.filter { (_, value) -> value !is JsonNull }.map { (key, value) ->
            val platform = NativePlatform.fromWire(key)
            val field = "platforms.$key"
            platform to (if (platform == null) fail(field, UNKNOWN_PLATFORM) else read(field, value))
        }
        return parsed.takeIf { items -> items.all { (platform, value) -> platform != null && value != null } }
            ?.associate { (platform, value) -> requireNotNull(platform) to requireNotNull(value) }
    }

    private fun Reader.integer(field: String, element: JsonElement?, range: IntRange): Int? {
        val primitive = element as? JsonPrimitive
        val text = primitive?.content?.trim()
        val number = text?.takeUnless { primitive is JsonNull }?.toBigDecimalOrNull()
        return when {
            !element.present() || primitive?.isString == true && text.isNullOrEmpty() -> fail(field, EMPTY)
            number == null -> fail(field, NOT_NUMBER)
            number.stripTrailingZeros().scale() > 0 -> fail(field, NOT_INTEGER)
            number < range.first.toBigDecimal() || number > range.last.toBigDecimal() ->
                fail(field, rangeMessage(range))
            else -> number.toInt()
        }
    }

    private fun JsonElement?.present(): Boolean = this != null && this !is JsonNull

    /** Первое нарушение разбора: следующие отказы его не перезаписывают. */
    private class Reader {
        private var violation: SizeValueViolation? = null

        fun <T> fail(field: String, message: String): T? {
            if (violation == null) violation = SizeValueViolation(field, message)
            return null
        }

        fun <T> result(value: T?): SizeValueCheck<T> =
            value?.let { SizeValueCheck.Valid(it) } ?: SizeValueCheck.Invalid(requireNotNull(violation))
    }
}
