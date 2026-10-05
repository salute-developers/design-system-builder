package com.dsbuilder.ds.designsystems.presentation

import kotlinx.serialization.Serializable

/** Цвета preview темы. */
@Serializable
data class ThemePreviewColorsResponse(
    val accentLight: String,
    val onAccentLight: String,
    val surfaceLight: String,
    val accentDark: String,
    val surfaceDark: String,
)
