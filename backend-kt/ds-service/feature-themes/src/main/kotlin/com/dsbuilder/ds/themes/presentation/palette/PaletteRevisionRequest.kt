package com.dsbuilder.ds.themes.presentation.palette

import kotlinx.serialization.Serializable

/** Тело операции без параметров. */
@Serializable
data class PaletteRevisionRequest(
    /** Ревизия темы. */
    val editRevision: Int,
)
