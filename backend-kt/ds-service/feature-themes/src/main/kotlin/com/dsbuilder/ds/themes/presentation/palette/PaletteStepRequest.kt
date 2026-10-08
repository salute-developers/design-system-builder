package com.dsbuilder.ds.themes.presentation.palette

import kotlinx.serialization.Serializable

/** Тело правки ступени. */
@Serializable
data class PaletteStepRequest(
    /** Новое значение HEX. */
    val value: String,
    /** Ревизия темы. */
    val editRevision: Int,
)
