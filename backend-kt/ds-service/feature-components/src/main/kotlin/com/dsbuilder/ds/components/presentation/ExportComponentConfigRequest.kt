package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for package component-config export. */
@Serializable
data class ExportComponentConfigRequest(
    /** Design system id carried by this contract. */
    val designSystemId: String,
    /** Components carried by this contract. */
    val components: List<String>? = null,
    /** Styles carried by this contract. */
    val styles: List<String>? = null,
)
