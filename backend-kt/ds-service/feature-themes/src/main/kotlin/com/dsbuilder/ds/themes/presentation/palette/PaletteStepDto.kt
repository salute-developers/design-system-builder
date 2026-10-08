package com.dsbuilder.ds.themes.presentation.palette

import kotlinx.serialization.Serializable

/** Ступень растяжки в группе. */
@Serializable
data class PaletteStepDto(
    /** Ступень. */
    val step: Int,
    /** Значение в группе. */
    val value: String,
    /** Значение источника в копии шаблона темы. */
    val templateValue: String,
    /** Есть ли правка ступени. */
    val overridden: Boolean,
    /** Число связей «токен, режим». */
    val linkedCount: Int,
)
