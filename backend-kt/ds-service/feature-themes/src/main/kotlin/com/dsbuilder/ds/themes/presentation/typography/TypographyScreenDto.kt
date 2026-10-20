package com.dsbuilder.ds.themes.presentation.typography

import kotlinx.serialization.Serializable

/** Стили одного экрана. */
@Serializable
data class TypographyScreenDto(
    /** Экран: `screen-l`, `screen-m`, `screen-s`. */
    val screen: String,
    /** Стили экрана. */
    val styles: List<TypographyStyleDto>,
)
