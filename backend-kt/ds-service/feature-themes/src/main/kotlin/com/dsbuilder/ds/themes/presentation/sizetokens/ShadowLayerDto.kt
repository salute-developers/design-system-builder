package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable

/** Слой тени в px. */
@Serializable
data class ShadowLayerDto(
    /** Смещение по X. */
    val offsetX: Int,
    /** Смещение по Y. */
    val offsetY: Int,
    /** Размытие. */
    val blur: Int,
    /** Растяжение. */
    val spread: Int,
    /** Цвет `#RRGGBBAA` или `#RRGGBB`. */
    val color: String,
)
