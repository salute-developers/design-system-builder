package com.dsbuilder.ds.themes.presentation.palette

import kotlinx.serialization.Serializable

/** Тело перестройки растяжки от опорного цвета. */
@Serializable
data class PaletteRebuildRequest(
    /** Опорная ступень. */
    val anchorStep: Int,
    /** Опорный цвет. */
    val value: String,
    /** Только вычислить значения. */
    val preview: Boolean = false,
    /** Ревизия темы. */
    val editRevision: Int,
)
