package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for component style creation. */
@Serializable
data class CreateStyleRequest(
    /** Design system id carried by this contract. */
    val designSystemId: String,
    /** Variation id carried by this contract. */
    val variationId: String,
    /** Name carried by this contract. */
    val name: String,
    /** Description carried by this contract. */
    val description: String? = null,
)
