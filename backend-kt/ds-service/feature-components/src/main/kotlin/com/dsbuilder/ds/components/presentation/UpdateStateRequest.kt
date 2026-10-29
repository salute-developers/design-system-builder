package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for state updates. */
@Serializable
data class UpdateStateRequest(
    /** Name carried by this contract. */
    val name: String? = null,
    /** Description carried by this contract. */
    val description: String? = null,
)
