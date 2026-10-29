package com.dsbuilder.ds.themes.domain.palette

import com.dsbuilder.ds.themes.domain.ThemePaletteType
import kotlin.math.abs

/** Отображаемые имена растяжек — правила `paletteDisplayName` и `sourcePaletteFriendlyIdentity` прототипа. */
object PaletteDisplayNames {
    private val additionalNames = mapOf(
        "h0" to "Red", "h10" to "Scarlet", "h20" to "Orange", "h30" to "Tangerine", "h40" to "Amber",
        "h50" to "Gold", "h60" to "Chartreuse", "h70" to "Lime", "h80" to "Grass", "h90" to "Leaf",
        "h100" to "Emerald", "h110" to "Malachite", "h120" to "Jade", "h130" to "Green", "h140" to "Mint",
        "h150" to "Teal", "h160" to "Cyan", "h170" to "Aqua", "h180" to "Sky", "h190" to "Azure",
        "h200" to "Blue", "h210" to "Cobalt", "h220" to "Ultramarine", "h230" to "Indigo",
        "h240" to "Blue Violet", "h250" to "Violet", "h260" to "Purple", "h270" to "Amethyst",
        "h280" to "Lavender", "h290" to "Orchid", "h300" to "Magenta", "h310" to "Fuchsia", "h320" to "Pink",
        "h330" to "Rose", "h340" to "Raspberry", "h350" to "Coral",
    )

    private val rebuildAnchors = listOf(
        0 to "Red", 18 to "Orange", 38 to "Amber", 52 to "Yellow", 76 to "Lime", 125 to "Green", 165 to "Teal",
        185 to "Cyan", 210 to "Blue", 225 to "Cobalt", 245 to "Indigo", 270 to "Violet", 292 to "Purple",
        315 to "Magenta", 335 to "Rose", 350 to "Coral", 360 to "Red",
    )

    private val camelBoundary = Regex("([a-z])([A-Z])")
    private const val GRAY_SATURATION = 8

    /** Имя растяжки шаблона: `coolGray` → `Cool Gray`, `h130` → `Green`. */
    fun templateName(ramp: PaletteRampRef): String = when (ramp.type) {
        ThemePaletteType.GENERAL ->
            ramp.shade
                .replace(camelBoundary, "$1 $2")
                .split(' ')
                .joinToString(" ") { it.replaceFirstChar(Char::uppercase) }
        ThemePaletteType.ADDITIONAL -> additionalNames[ramp.shade] ?: ramp.shade.uppercase()
    }

    /** Ближайшее к тону имя цвета; для малонасыщенных — `Gray`. */
    fun friendlyName(hex: String, fallback: String): String {
        val color = PaletteColors.hexToRgba(hex) ?: return fallback
        val hsl = PaletteColors.rgbToHsl(color)
        if (hsl.s < GRAY_SATURATION) return "Gray"
        return rebuildAnchors.minBy { abs(it.first - hsl.h) }.second
    }

    /** Имя растяжки в группе: по опорному цвету перестройки или по источнику. */
    fun of(source: PaletteRampRef, anchor: PaletteAnchor?): String =
        anchor?.let { friendlyName(it.value, templateName(source)) } ?: templateName(source)
}
