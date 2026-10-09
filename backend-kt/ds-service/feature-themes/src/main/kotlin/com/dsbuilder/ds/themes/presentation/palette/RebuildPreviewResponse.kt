package com.dsbuilder.ds.themes.presentation.palette

import kotlinx.serialization.Serializable

/** Значения ступеней перестройки без изменения палитры. */
@Serializable
data class RebuildPreviewResponse(
    /** Ступени по возрастанию. */
    val steps: List<PaletteStepValueDto>,
)
