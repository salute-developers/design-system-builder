package com.dsbuilder.ds.themes.domain.palette

import kotlin.math.max
import kotlin.math.min

/**
 * Перестройка растяжки от опорного цвета — `sourcePaletteRebuildValues` прототипа: опорная ступень получает
 * тон и насыщенность выбранного цвета, остальные — сдвиг тона и отношение насыщенностей; светлота — из источника.
 */
object PaletteRampRebuilder {
    private const val MIN_REFERENCE_SATURATION = 3
    private const val FULL_TURN = 360
    private const val MAX_SATURATION = 100

    /** Значения ступеней `#RRGGBB` или `null`, если цвет некорректен либо у источника нет опорной ступени. */
    fun rebuild(source: Map<Int, String>, anchorStep: Int, anchorHex: String): Map<Int, String>? {
        val pickedHsl = PaletteColors.hexToRgba(anchorHex)?.let(PaletteColors::rgbToHsl)
        val reference = source[anchorStep]?.let(PaletteColors::hexToRgba)?.let(PaletteColors::rgbToHsl)
        if (pickedHsl == null || reference == null) return null
        val hueShift = pickedHsl.h - reference.h
        val ratio = if (reference.s >= MIN_REFERENCE_SATURATION) pickedHsl.s.toDouble() / max(reference.s, 1) else null
        return source.mapValues { (step, baseHex) ->
            val base = PaletteColors.rgbToHsl(PaletteColors.hexToRgba(baseHex) ?: return null)
            val anchor = step == anchorStep
            val hue = if (anchor) pickedHsl.h else ((base.h + hueShift) % FULL_TURN + FULL_TURN) % FULL_TURN
            val saturation = when {
                anchor -> pickedHsl.s
                ratio == null -> min(MAX_SATURATION, max(0, pickedHsl.s))
                else -> max(0, min(MAX_SATURATION, PaletteColors.jsRound(base.s * ratio)))
            }
            val rgb = PaletteColors.hslToRgb(PaletteColors.Hsl(hue, saturation, base.l))
            PaletteColors.rgbaToHex(rgb.r, rgb.g, rgb.b).uppercase()
        }
    }

    /** Опорная ступень по умолчанию: `500`, иначе средняя ступень источника. */
    fun defaultAnchorStep(steps: Collection<Int>): Int {
        val sorted = steps.sorted()
        return if (500 in steps) 500 else sorted[sorted.size / 2]
    }
}
