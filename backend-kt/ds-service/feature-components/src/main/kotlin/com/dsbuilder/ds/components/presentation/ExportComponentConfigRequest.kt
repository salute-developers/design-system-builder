package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for package component-config export. */
@Serializable
data class ExportComponentConfigRequest(
    /** Platform of the exported components. */
    val platform: String,
    /** Components carried by this contract. */
    val components: List<String>? = null,
    /** Styles carried by this contract. */
    val styles: List<String>? = null,
    /** Отдать ID вариаций и стилей для редактора. */
    val editorIds: Boolean = false,
)
