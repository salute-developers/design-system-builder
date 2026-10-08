package com.dsbuilder.ds.themes.presentation.palette

import kotlinx.serialization.Serializable

/** Тело удаления растяжки из группы. */
@Serializable
data class PaletteRemoveRampRequest(
    /** `replace` или `detach`. */
    val strategy: String? = null,
    /** Растяжка замены. */
    val replacement: PaletteRampRefDto? = null,
    /** Ревизия темы. */
    val editRevision: Int,
)
