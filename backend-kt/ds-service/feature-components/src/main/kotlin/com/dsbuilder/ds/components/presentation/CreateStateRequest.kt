package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for state creation. */
@Serializable
data class CreateStateRequest(
    /** Component id carried by this contract. */
    val componentId: String? = null,
    /** Name carried by this contract. */
    val name: String,
    /** Description carried by this contract. */
    val description: String? = null,
)
