package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.InvariantPropertyValue
import kotlinx.serialization.Serializable

/** External invariant property value representation. */
@Serializable
data class InvariantPropertyValueResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Property id carried by this contract. */
    val propertyId: String,
    /** Design system id carried by this contract. */
    val designSystemId: String,
    /** Component id carried by this contract. */
    val componentId: String,
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
        fun from(value: InvariantPropertyValue) = InvariantPropertyValueResponse(
            value.id.toString(),
            value.propertyId.toString(),
            value.designSystemId.toString(),
            value.componentId.toString(),
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
