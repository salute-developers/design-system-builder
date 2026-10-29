package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for variation patching. */
@Serializable
data class UpdateVariationRequest(
    /** Name carried by this contract. */
    val name: String? = null,
    /** Description carried by this contract. */
    val description: String? = null,
)
