package com.dsbuilder.ds.designsystems.presentation

import kotlinx.serialization.Serializable

/** Цвета preview темы. */
@Serializable
data class ThemePreviewColorsResponse(
    /** Акцентный цвет светлой темы. */
    val accentLight: String,
    /** Цвет содержимого на акцентном фоне светлой темы. */
    val onAccentLight: String,
    /** Цвет поверхности светлой темы. */
    val surfaceLight: String,
    /** Акцентный цвет тёмной темы. */
    val accentDark: String,
    /** Цвет поверхности тёмной темы. */
    val surfaceDark: String,
)
