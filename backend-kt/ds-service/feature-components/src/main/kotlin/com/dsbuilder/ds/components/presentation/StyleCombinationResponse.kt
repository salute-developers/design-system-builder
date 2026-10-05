package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.StyleCombination
import kotlinx.serialization.Serializable

/** External style-combination representation. */
@Serializable
data class StyleCombinationResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Property id carried by this contract. */
    val propertyId: String,
    /** Appearance id carried by this contract. */
    val appearanceId: String,
    /** Combination key carried by this contract. */
    val combinationKey: String,
    /** Value carried by this contract. */
    val value: String,
    /** Token id carried by this contract. */
    val tokenId: String?,
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
        fun from(value: StyleCombination) = StyleCombinationResponse(
            value.id.toString(), value.propertyId.toString(), value.appearanceId.toString(),
            value.combinationKey, value.value, value.tokenId?.toString(), value.alpha, value.adjustment,
            value.position, value.stateSetId.toString(), value.createdAt.toString(), value.updatedAt.toString(),
        )
    }
}
