package com.dsbuilder.ds.themes.domain

/** Краткое представление цветов темы для списков. */
data class ThemePreview(
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
)
