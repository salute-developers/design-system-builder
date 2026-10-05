package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for variation creation. */
@Serializable
data class CreateVariationRequest(
    /** Component id carried by this contract. */
    val componentId: String,
    /** Name carried by this contract. */
    val name: String,
    /** Description carried by this contract. */
    val description: String? = null,
)
