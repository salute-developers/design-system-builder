package com.dsbuilder.ds.themes.domain.sizetokens

import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Перевод значений токенов размеров в формат платформ и обратно.
 *
 * - радиус: `web` — `"<px/16>rem"`, `android` и `ios` — `{ kind: "round", cornerRadius }`;
 * - отступ: `web` — `"<px/16>rem"`, `android` и `ios` — `{ value }`;
 * - слой тени: `web` — `"<x>rem <y>rem <blur>rem <spread>rem <#RRGGBBAA>"`, `android` —
 *   `{ color, offsetX, offsetY, blurRadius, spreadRadius, fallbackElevation }`, `ios` — без `fallbackElevation`.
 *
 * Источник чтения в px — значение `web`.
 */
object SizePlatformValues {
    private val REM_PX = BigDecimal(16)
    private val LENGTH = Regex("""^([+-]?(?:\d+\.?\d*|\.\d+))(rem|px)?$""")
    private val HEX6 = Regex("^#[0-9A-Fa-f]{6}$")
    private const val OPAQUE = "FF"
    private const val SHADOW_PARTS = 5
    private val NATIVE_FIELDS = listOf("offsetX", "offsetY", "blurRadius", "spreadRadius")

    /**
     * Значения всех платформ: `web` — из основного значения с `overridden: false`; `ios` и `android` — своё значение
     * из [SizeTokenValue] с `overridden: true` или построенное из веба с `overridden: false`.
     */
    fun write(kind: SizeTokenKind, value: SizeTokenValue): List<SizeWrittenValue> =
        ThemeTokenPlatform.entries.map { platform ->
            val native = NativePlatform.entries.firstOrNull { it.platform == platform }
            when (value) {
                is SizeTokenValue.Dimension -> {
                    val own = native?.let(value.platforms::get)
                    SizeWrittenValue(platform, dimension(kind, platform, own ?: value.valuePx), own != null)
                }
                is SizeTokenValue.Shadow -> {
                    val own = native?.let(value.platforms::get)
                    val layers = own ?: value.layers
                    SizeWrittenValue(platform, shadow(platform, layers, value.fallbackElevation), own != null)
                }
            }
        }

    /** Значение радиуса или отступа [px] в формате платформы [platform]. */
    fun dimension(kind: SizeTokenKind, platform: ThemeTokenPlatform, px: Int): JsonElement = when {
        platform == ThemeTokenPlatform.WEB -> buildJsonArray { add(JsonPrimitive(rem(px))) }
        kind == SizeTokenKind.RADIUS -> buildJsonArray {
            add(
                buildJsonObject {
                    put("kind", "round")
                    put("cornerRadius", px)
                },
            )
        }
        else -> buildJsonArray { add(buildJsonObject { put("value", px) }) }
    }

    /** Слои тени [layers] в формате платформы [platform]; [fallbackElevation] пишется только на Android. */
    fun shadow(platform: ThemeTokenPlatform, layers: List<ShadowLayer>, fallbackElevation: Int): JsonElement =
        buildJsonArray {
            layers.forEachIndexed { index, layer ->
                val color = normalizedColor(layer.color)
                when (platform) {
                    ThemeTokenPlatform.WEB -> add(
                        JsonPrimitive(
                            listOf(layer.offsetX, layer.offsetY, layer.blur, layer.spread).joinToString(" ") {
                                rem(it)
                            } + " $color",
                        ),
                    )
                    else -> add(
                        buildJsonObject {
                            put("color", color)
                            put("offsetX", layer.offsetX)
                            put("offsetY", layer.offsetY)
                            put("blurRadius", layer.blur)
                            put("spreadRadius", layer.spread)
                            if (platform == ThemeTokenPlatform.ANDROID) {
                                put("fallbackElevation", if (index == 0) fallbackElevation else 0)
                            }
                        },
                    )
                }
            }
        }

    /** Число `rem` без лишних нулей: 12 px → `0.75rem`, 0 px → `0rem`, 20 px → `1.25rem`. */
    fun rem(px: Int): String = BigDecimal(px).divide(REM_PX).stripTrailingZeros().toPlainString() + "rem"

    /** Цвет `#RRGGBBAA` в верхнем регистре; `#RRGGBB` получает непрозрачность `FF`. */
    fun normalizedColor(color: String): String =
        if (HEX6.matches(color)) "${color.uppercase()}$OPAQUE" else color.uppercase()

    /** Радиус или отступ в px из значения платформы [platform] или `null`, если значение не читается. */
    fun readDimension(platform: ThemeTokenPlatform, value: JsonElement?): Int? {
        val item = (value as? JsonArray)?.firstOrNull() ?: value
        return when {
            item == null -> null
            platform == ThemeTokenPlatform.WEB -> (item as? JsonPrimitive)?.content?.let(::lengthPx)
            item is JsonObject -> (item["cornerRadius"] ?: item["value"])?.let(::number)
            else -> number(item)
        }
    }

    /** Слои тени в px из значения платформы [platform] или `null`, если значение не читается. */
    fun readShadow(platform: ThemeTokenPlatform, value: JsonElement?): List<ShadowLayer>? {
        val items = value as? JsonArray ?: return null
        val layers = items.map { item ->
            if (platform == ThemeTokenPlatform.WEB) {
                (item as? JsonPrimitive)?.takeIf(JsonPrimitive::isString)?.content?.let(::cssLayer)
            } else {
                (item as? JsonObject)?.let(::nativeLayer)
            }
        }
        return layers.takeIf { all -> all.all { it != null } }?.filterNotNull()
    }

    /** Запасная высота из первого слоя значения Android; без неё `0`. */
    fun readFallbackElevation(value: JsonElement?): Int =
        ((value as? JsonArray)?.firstOrNull() as? JsonObject)?.get("fallbackElevation")?.let(::number) ?: 0

    /** Совпадают ли слои с точностью до регистра и непрозрачности цвета. */
    fun sameLayers(left: List<ShadowLayer>, right: List<ShadowLayer>): Boolean = normalized(left) == normalized(right)

    private fun normalized(layers: List<ShadowLayer>) = layers.map { it.copy(color = normalizedColor(it.color)) }

    private fun cssLayer(css: String): ShadowLayer? {
        val parts = css.trim().split(Regex("\\s+"))
        if (parts.size != SHADOW_PARTS) return null
        val numbers = parts.take(SHADOW_PARTS - 1).map { lengthPx(it) ?: return null }
        return layer(numbers, parts.last())
    }

    private fun nativeLayer(item: JsonObject): ShadowLayer? {
        val numbers = NATIVE_FIELDS.map { field -> item[field]?.let(::number) }
        val color = (item["color"] as? JsonPrimitive)?.takeIf(JsonPrimitive::isString)?.content
        if (color == null || numbers.any { it == null }) return null
        return layer(numbers.filterNotNull(), color)
    }

    /** Слой из чисел в порядке `offsetX`, `offsetY`, `blur`, `spread` и цвета. */
    internal fun layer(numbers: List<Int>, color: String): ShadowLayer =
        ShadowLayer(offsetX = numbers[0], offsetY = numbers[1], blur = numbers[2], spread = numbers[3], color = color)

    private fun lengthPx(text: String): Int? {
        val match = LENGTH.matchEntire(text.trim()) ?: return null
        val amount = match.groupValues[1].toBigDecimal()
        val px = if (match.groupValues[2] == "px") amount else amount.multiply(REM_PX)
        return px.setScale(0, RoundingMode.HALF_UP).toInt()
    }

    private fun number(element: JsonElement): Int? =
        (element as? JsonPrimitive)?.takeUnless(JsonPrimitive::isString)?.content?.toBigDecimalOrNull()
            ?.setScale(0, RoundingMode.HALF_UP)?.toInt()
}
