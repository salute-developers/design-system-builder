package com.dsbuilder.ds.designsystems.presentation

import kotlinx.serialization.Serializable

/** Цвета preview темы. */
@Serializable
data class ThemePreviewColorsResponse(
    /** Акцентный цвет светлого режима. */
    val accentLight: String,
    /** Цвет поверх акцента в светлом режиме. */
    val onAccentLight: String,
    /** Цвет поверхности светлого режима. */
    val surfaceLight: String,
    /** Акцентный цвет тёмного режима. */
    val accentDark: String,
    /** Цвет поверхности тёмного режима. */
    val surfaceDark: String,
)
