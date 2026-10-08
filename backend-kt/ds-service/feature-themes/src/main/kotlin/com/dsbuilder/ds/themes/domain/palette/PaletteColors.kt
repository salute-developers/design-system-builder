package com.dsbuilder.ds.themes.domain.palette

import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/**
 * Цветовые формулы `builder/color-utils.js` прототипа SDDS Portal и клиента DS Builder. Округление —
 * как `Math.round` в JavaScript, чтобы перестройка давала побайтно те же значения.
 */
object PaletteColors {
    private val hex6 = Regex("^#?[0-9A-Fa-f]{6}$")
    private val hexDigits3 = Regex("^[0-9a-fA-F]{3}$")
    private val hexDigits6 = Regex("^[0-9a-fA-F]{6}$")
    private val hexDigits8 = Regex("^[0-9a-fA-F]{8}$")

    /** Цвет в RGB 0–255 и альфа 0–1. */
    data class Rgba(
        /** Красный канал. */
        val r: Double,
        /** Зелёный канал. */
        val g: Double,
        /** Синий канал. */
        val b: Double,
        /** Прозрачность. */
        val a: Double,
    )

    /** Цвет в HSL: тон 0–359, насыщенность и светлота 0–100. */
    data class Hsl(
        /** Тон. */
        val h: Int,
        /** Насыщенность. */
        val s: Int,
        /** Светлота. */
        val l: Int,
    )

    /** Округление `Math.round` из JavaScript. */
    fun jsRound(value: Double): Int = floor(value + HALF).toInt()

    /** `true` для `#RRGGBB` или `RRGGBB`. */
    fun isHexColor(value: String): Boolean = hex6.matches(value.trim())

    /** `#RRGGBB` в верхнем регистре. */
    fun toUpperHex(value: String): String = "#" + normalize(value, includeAlpha = false).uppercase()

    /** RGBA из HEX или `null`. */
    fun hexToRgba(hex: String): Rgba? {
        val value = normalize(hex, includeAlpha = true)
        if (!hexDigits8.matches(value)) return null
        return Rgba(
            r = value.substring(0, 2).toInt(HEX_RADIX).toDouble(),
            g = value.substring(2, 4).toInt(HEX_RADIX).toDouble(),
            b = value.substring(4, 6).toInt(HEX_RADIX).toDouble(),
            a = value.substring(6, 8).toInt(HEX_RADIX) / CHANNEL_MAX,
        )
    }

    /** `#rrggbb` (или `#rrggbbaa` при `a < 1`) в нижнем регистре, как в прототипе. */
    fun rgbaToHex(r: Double, g: Double, b: Double, a: Double = 1.0): String {
        val base = "#" + channel(r) + channel(g) + channel(b)
        return if (a >= 1.0) base else base + channel(a * CHANNEL_MAX)
    }

    /** HSL цвета с округлением компонентов. */
    fun rgbToHsl(color: Rgba): Hsl {
        val red = color.r / CHANNEL_MAX
        val green = color.g / CHANNEL_MAX
        val blue = color.b / CHANNEL_MAX
        val maximum = max(red, max(green, blue))
        val minimum = min(red, min(green, blue))
        val delta = maximum - minimum
        val lightness = (maximum + minimum) / 2
        if (delta == 0.0) return Hsl(0, 0, jsRound(lightness * PERCENT))
        val saturation = if (lightness > HALF) delta / (2 - maximum - minimum) else delta / (maximum + minimum)
        var hue = when (maximum) {
            red -> ((green - blue) / delta) % HUE_SECTORS
            green -> (blue - red) / delta + 2
            else -> (red - green) / delta + 4
        } * DEGREES_PER_SECTOR
        if (hue < 0) hue += FULL_TURN
        return Hsl(jsRound(hue), jsRound(saturation * PERCENT), jsRound(lightness * PERCENT))
    }

    /** RGB 0–255 без округления. */
    fun hslToRgb(hsl: Hsl): Rgba {
        val hue = ((hsl.h % FULL_TURN_INT) + FULL_TURN_INT) % FULL_TURN_INT
        val saturation = hsl.s / PERCENT
        val lightness = hsl.l / PERCENT
        val c = (1 - abs(2 * lightness - 1)) * saturation
        val x = c * (1 - abs((hue / DEGREES_PER_SECTOR) % 2 - 1))
        val m = lightness - c / 2
        val (r, g, b) = when {
            hue < 60 -> Triple(c, x, 0.0)
            hue < 120 -> Triple(x, c, 0.0)
            hue < 180 -> Triple(0.0, c, x)
            hue < 240 -> Triple(0.0, x, c)
            hue < 300 -> Triple(x, 0.0, c)
            else -> Triple(c, 0.0, x)
        }
        return Rgba((r + m) * CHANNEL_MAX, (g + m) * CHANNEL_MAX, (b + m) * CHANNEL_MAX, 1.0)
    }

    /** HEX с альфа-каналом `round(opacity * 255)`, как в клиенте и `js/cli`. */
    fun withOpacity(hex: String, opacity: Double?): String {
        if (opacity == null || opacity >= 1.0) return hex
        val alpha = jsRound(max(0.0, opacity) * CHANNEL_MAX).toString(HEX_RADIX).padStart(2, '0').uppercase()
        return hex.take(HEX_LENGTH) + alpha
    }

    private fun channel(value: Double): String =
        jsRound(max(0.0, min(CHANNEL_MAX, value))).toString(HEX_RADIX).padStart(2, '0')

    private fun normalize(hex: String, includeAlpha: Boolean): String {
        var value = hex.trim().removePrefix("#")
        if (hexDigits3.matches(value)) value = value.map { "$it$it" }.joinToString("")
        if (includeAlpha && hexDigits6.matches(value)) value += "ff"
        if (!includeAlpha && hexDigits8.matches(value)) value = value.take(6)
        return value
    }

    private const val HALF = 0.5
    private const val HEX_RADIX = 16
    private const val HEX_LENGTH = 7
    private const val CHANNEL_MAX = 255.0
    private const val PERCENT = 100.0
    private const val HUE_SECTORS = 6.0
    private const val DEGREES_PER_SECTOR = 60.0
    private const val FULL_TURN = 360.0
    private const val FULL_TURN_INT = 360
}
