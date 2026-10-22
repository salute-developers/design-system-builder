package com.dsbuilder.ds.themes.presentation.typography

import kotlinx.serialization.Serializable

/** Семейство шрифта дизайн-системы. */
@Serializable
data class TypographyFamilyDto(
    /** Имя токена `fontFamily`. */
    val name: String,
    /** Имя шрифта в текущей теме. */
    val fontName: String,
)
