package com.dsbuilder.ds.themes.presentation

import com.dsbuilder.ds.themes.domain.ThemePreview
import kotlinx.serialization.Serializable

/** Внешнее краткое представление цветов темы. */
@Serializable
data class ThemePreviewResponse(
    /** Светлый акцентный цвет. */
    val accentLight: String,
    /** Светлый цвет текста поверх акцента. */
    val onAccentLight: String,
    /** Светлый цвет поверхности. */
    val surfaceLight: String,
    /** Тёмный акцентный цвет. */
    val accentDark: String,
    /** Тёмный цвет поверхности. */
    val surfaceDark: String,
) {
    companion object {
        /** Создаёт DTO из предметного представления. */
        fun from(value: ThemePreview) = ThemePreviewResponse(
            value.accentLight,
            value.onAccentLight,
            value.surfaceLight,
            value.accentDark,
            value.surfaceDark,
        )
    }
}
