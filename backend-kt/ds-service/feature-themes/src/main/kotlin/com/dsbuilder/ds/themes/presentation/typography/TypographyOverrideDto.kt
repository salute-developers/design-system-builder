package com.dsbuilder.ds.themes.presentation.typography

import kotlinx.serialization.Serializable

/** Свои значения платформы у стиля: только поля, которые отличаются от веба. */
@Serializable
data class TypographyOverrideDto(
    /** Размер в px. */
    val sizePx: Double? = null,
    /** Высота строки в px. */
    val lineHeightPx: Double? = null,
    /** Трекинг в em. */
    val letterSpacingEm: Double? = null,
    /** Веса начертаний: `normal`, `medium`, `bold` → вес. */
    val weights: Map<String, Int> = emptyMap(),
)
