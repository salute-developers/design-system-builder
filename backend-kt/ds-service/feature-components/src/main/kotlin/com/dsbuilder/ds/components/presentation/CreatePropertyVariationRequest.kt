package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for property-to-variation link creation. */
@Serializable
data class CreatePropertyVariationRequest(
    /** Property id carried by this contract. */
    val propertyId: String,
    /** Variation id carried by this contract. */
    val variationId: String,
)
