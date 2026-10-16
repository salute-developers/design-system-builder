package com.dsbuilder.ds.themes.presentation.palette

import kotlinx.serialization.Serializable

/** Значение ступени `{ step, value }`. */
@Serializable
data class PaletteStepValueDto(
    /** Ступень. */
    val step: Int,
    /** HEX `#RRGGBB`. */
    val value: String,
)
