package com.dsbuilder.ds.themes.presentation.palette

import kotlinx.serialization.Serializable

/** Слот или источник растяжки `{ type, shade }`. */
@Serializable
data class PaletteRampRefDto(
    /** Тип палитры `general` или `additional`. */
    val type: String,
    /** Оттенок. */
    val shade: String,
)
