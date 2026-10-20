package com.dsbuilder.ds.themes.domain.sizetokens

/** Слой тени в px и цвет в формате Hex. */
data class ShadowLayer(
    /** Смещение по X. */
    val offsetX: Int,
    /** Смещение по Y. */
    val offsetY: Int,
    /** Размытие. */
    val blur: Int,
    /** Растяжение. */
    val spread: Int,
    /** Цвет `#RRGGBB` или `#RRGGBBAA`. */
    val color: String,
)
