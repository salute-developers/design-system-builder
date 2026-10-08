package com.dsbuilder.ds.themes.presentation.palette

import kotlinx.serialization.Serializable

/** Тело создания и переименования группы. */
@Serializable
data class PaletteGroupLabelRequest(
    /** Название группы. */
    val label: String,
    /** Ревизия темы. */
    val editRevision: Int,
)
