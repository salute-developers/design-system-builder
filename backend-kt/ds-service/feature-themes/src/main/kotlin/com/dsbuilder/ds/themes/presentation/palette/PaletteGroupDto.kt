package com.dsbuilder.ds.themes.presentation.palette

import kotlinx.serialization.Serializable

/** Группа палитры темы. */
@Serializable
data class PaletteGroupDto(
    /** Идентификатор группы. */
    val id: String,
    /** `system` или `custom`. */
    val kind: String,
    /** Ключ системной группы. */
    val systemKey: String?,
    /** Название. */
    val label: String,
    /** Растяжки группы. */
    val ramps: List<PaletteRampDto>,
)
