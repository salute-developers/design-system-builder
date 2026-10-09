package com.dsbuilder.ds.themes.presentation.palette

import kotlinx.serialization.Serializable

/** Опорный цвет перестроенной растяжки. */
@Serializable
data class PaletteAnchorDto(
    /** Опорная ступень. */
    val step: Int,
    /** Опорный цвет `#RRGGBB`. */
    val value: String,
)
