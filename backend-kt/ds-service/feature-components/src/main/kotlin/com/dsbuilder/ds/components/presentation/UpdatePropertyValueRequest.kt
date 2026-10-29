package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body shared by variation and invariant property-value updates. */
@Serializable
data class UpdatePropertyValueRequest(
    /** Token id carried by this contract. */
    val tokenId: String? = null,
    /** Value carried by this contract. */
    val value: String? = null,
    /** Alpha carried by this contract. */
    val alpha: String? = null,
    /** Adjustment carried by this contract. */
    val adjustment: String? = null,
    /** State set id carried by this contract. */
    val stateSetId: String? = null,
)
