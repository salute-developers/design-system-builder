package com.dsbuilder.ds.themes.domain.palette

/** Опорная ступень перестроенной растяжки. */
data class PaletteAnchor(
    /** Ступень. */
    val step: Int,
    /** Опорный цвет `#RRGGBB`. */
    val value: String,
)
