package com.dsbuilder.ds.themes.presentation.palette

import kotlinx.serialization.Serializable

/** Растяжка копии шаблона темы. */
@Serializable
data class PaletteTemplateRampDto(
    /** Тип палитры. */
    val type: String,
    /** Оттенок. */
    val shade: String,
    /** Ступени по возрастанию. */
    val steps: List<PaletteStepValueDto>,
)
