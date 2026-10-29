package com.dsbuilder.ds.themes.domain.colortokens

/** Стоп web-градиента: цвет и позиция в процентах от 0 до 100. */
data class GradientStop(
    /** Цвет стопа. */
    val color: StopColor,
    /** Позиция в процентах. */
    val position: Double,
)
