package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.VariationPropertyValue
import kotlinx.serialization.Serializable

/** External variation property value representation. */
@Serializable
data class VariationPropertyValueResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Property id carried by this contract. */
    val propertyId: String,
    /** Style id carried by this contract. */
    val styleId: String,
    /** Appearance id carried by this contract. */
    val appearanceId: String,
    /** Token id carried by this contract. */
    val tokenId: String?,
    /** Value carried by this contract. */
    val value: String?,
    /** Alpha carried by this contract. */
    val alpha: String?,
    /** Adjustment carried by this contract. */
    val adjustment: String?,
    /** Position carried by this contract. */
    val position: Int,
    /** State set id carried by this contract. */
    val stateSetId: String,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: VariationPropertyValue) = VariationPropertyValueResponse(
            value.id.toString(),
            value.propertyId.toString(),
            value.styleId.toString(),
            value.appearanceId.toString(),
            value.tokenId?.toString(),
            value.value,
            value.alpha,
            value.adjustment,
            value.position,
            value.stateSetId.toString(),
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
