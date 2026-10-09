package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for style-combination updates. */
@Serializable
data class UpdateStyleCombinationRequest(
    /** Value carried by this contract. */
    val value: String? = null,
    /** Token id carried by this contract. */
    val tokenId: String? = null,
    /** Alpha carried by this contract. */
    val alpha: String? = null,
    /** Adjustment carried by this contract. */
    val adjustment: String? = null,
    /** State set id carried by this contract. */
    val stateSetId: String? = null,
)
