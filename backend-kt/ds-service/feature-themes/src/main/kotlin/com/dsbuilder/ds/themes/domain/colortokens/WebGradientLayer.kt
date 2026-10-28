package com.dsbuilder.ds.themes.domain.colortokens

/** Разобранная градиентная функция web-слоя по грамматике редактора. */
sealed interface WebGradientLayer {
    /** Стопы в порядке записи. */
    val stops: List<GradientStop>

    /** `linear-gradient(<angle>deg, …)`. */
    data class Linear(
        /** Угол в градусах. */
        val angle: Double,
        override val stops: List<GradientStop>,
    ) : WebGradientLayer

    /** `radial-gradient(<r>% <r>% at <x>% <y>%, …)`. */
    data class Radial(
        /** Радиус в процентах. */
        val radius: Double,
        /** Центр по горизонтали в процентах. */
        val centerX: Double,
        /** Центр по вертикали в процентах. */
        val centerY: Double,
        override val stops: List<GradientStop>,
    ) : WebGradientLayer

    /** `conic-gradient(from <angle>deg at <x>% <y>%, …)`. */
    data class Conic(
        /** Начальный угол в градусах. */
        val from: Double,
        /** Центр по горизонтали в процентах. */
        val centerX: Double,
        /** Центр по вертикали в процентах. */
        val centerY: Double,
        override val stops: List<GradientStop>,
    ) : WebGradientLayer
}
