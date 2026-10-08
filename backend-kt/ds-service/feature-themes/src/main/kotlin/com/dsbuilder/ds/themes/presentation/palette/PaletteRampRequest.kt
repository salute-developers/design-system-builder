package com.dsbuilder.ds.themes.presentation.palette

import kotlinx.serialization.Serializable

/** Тело добавления растяжки и замены источника. */
@Serializable
data class PaletteRampRequest(
    /** Тип палитры. */
    val type: String,
    /** Оттенок. */
    val shade: String,
    /** Ревизия темы. */
    val editRevision: Int,
)
