package com.dsbuilder.ds.themes.domain.palette

/** Ступень растяжки в группе. */
data class PaletteStepView(
    /** Ступень. */
    val step: Int,
    /** Значение в группе. */
    val value: String,
    /** Значение источника в копии шаблона темы. */
    val templateValue: String,
    /** Ступень изменена в группе. */
    val overridden: Boolean,
    /** Число пар «токен — режим», ссылающихся на ступень. */
    val linkedCount: Int,
)
