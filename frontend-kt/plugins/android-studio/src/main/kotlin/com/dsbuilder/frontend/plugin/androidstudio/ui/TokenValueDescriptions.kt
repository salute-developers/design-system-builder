package com.dsbuilder.frontend.plugin.androidstudio.ui

import androidx.compose.foundation.layout.size
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import com.dsbuilder.frontend.plugin.androidstudio.tokens.GradientLayer
import com.dsbuilder.frontend.plugin.androidstudio.tokens.ShadowLayerValue
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenValuePayload

/**
 * Показывает цвет в Android-порядке `#AARRGGBB` (как `Color(0xAARRGGBB)` в Compose). Источник хранит
 * `#RRGGBBAA` (прозрачность в конце) или шестизначный `#RRGGBB`: в первом случае альфа переносится
 * в начало, второй получает `FF` (непрозрачный). Регистр — верхний, не hex остаётся как есть.
 */
internal fun formatHexAarrggbb(hex: String): String {
    val digits = hex.trim().removePrefix("#").uppercase()
    if (digits.any { !it.isDigit() && it !in 'A'..'F' }) return hex
    return when (digits.length) {
        RGB_DIGITS -> "#FF$digits"
        RGBA_DIGITS -> "#${digits.substring(RGB_DIGITS)}${digits.substring(0, RGB_DIGITS)}"
        else -> hex
    }
}

private const val RGB_DIGITS = 6
private const val RGBA_DIGITS = 8

internal fun describeValue(payload: TokenValuePayload, rawValue: String?): String = when (payload) {
    is TokenValuePayload.ColorValue -> formatHexAarrggbb(payload.hex)
    is TokenValuePayload.ShapeValue -> when {
        payload.cornerRadiusDp >= SHAPE_CIRCLE_THRESHOLD_DP -> "circle"
        else -> "${payload.cornerRadiusDp.formatCompact()}dp"
    }
    is TokenValuePayload.SpacingValue -> "${payload.valueDp.formatCompact()}dp"
    is TokenValuePayload.GradientValue -> payload.layers.joinToString(", ") { it.describe() }
    is TokenValuePayload.ShadowValue -> describeShadow(payload.layers)
    is TokenValuePayload.TypographyValue ->
        "${payload.fontSizeSp.formatCompact()}sp / ${payload.lineHeightSp.formatCompact()}sp, ${payload.fontWeight}"
    // rawValue пустой, если значение опубликовано, но само поле value в БД равно null
    // (реальный случай — см. outline.default.accent) — показываем так же, как отсутствующее.
    TokenValuePayload.Unsupported -> rawValue?.ifBlank { null } ?: "—"
}

private fun GradientLayer.describe(): String = when (this) {
    is GradientLayer.Linear -> "linear, ${angle.formatCompact()}°"
    is GradientLayer.Radial -> "radial"
    is GradientLayer.Angular -> "angular"
    is GradientLayer.Solid -> formatHexAarrggbb(hex)
}

private fun describeShadow(layers: List<ShadowLayerValue>): String {
    val first = layers.first()
    val extra = if (layers.size > 1) " +${layers.size - 1}" else ""
    return "blur ${first.blurRadius.formatCompact()}dp, offset ${first.offsetY.formatCompact()}dp$extra"
}

/** `12.0` → `"12"`, `-0.02` → `"-0.02"` — без лишнего `.0` для целых значений. */
private fun Float.formatCompact(): String =
    if (this == this.toInt().toFloat()) this.toInt().toString() else this.toString()
