package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for style-combination creation. */
@Serializable
data class CreateStyleCombinationRequest(
    /** Property id carried by this contract. */
    val propertyId: String,
    /** Appearance id carried by this contract. */
    val appearanceId: String,
    /** Combination key carried by this contract. */
    val combinationKey: String? = null,
    /** Value carried by this contract. */
    val value: String,
    /** Token id carried by this contract. */
    val tokenId: String? = null,
    /** Alpha carried by this contract. */
    val alpha: String? = null,
    /** Adjustment carried by this contract. */
    val adjustment: String? = null,
    /** State set id carried by this contract. */
    val stateSetId: String,
)
