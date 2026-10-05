package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.PropertyVariation
import kotlinx.serialization.Serializable

/** External property-to-variation link representation. */
@Serializable
data class PropertyVariationResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Property id carried by this contract. */
    val propertyId: String,
    /** Variation id carried by this contract. */
    val variationId: String,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: PropertyVariation) = PropertyVariationResponse(
            value.id.toString(),
            value.propertyId.toString(),
            value.variationId.toString(),
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
