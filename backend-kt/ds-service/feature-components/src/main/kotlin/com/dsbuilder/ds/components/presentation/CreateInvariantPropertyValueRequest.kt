package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for invariant property-value creation. */
@Serializable
data class CreateInvariantPropertyValueRequest(
    /** Property id carried by this contract. */
    val propertyId: String,
    /** Design system id carried by this contract. */
    val designSystemId: String,
    /** Component id carried by this contract. */
    val componentId: String,
    /** Appearance id carried by this contract. */
    val appearanceId: String,
    /** Token id carried by this contract. */
    val tokenId: String? = null,
    /** Value carried by this contract. */
    val value: String? = null,
    /** Alpha carried by this contract. */
    val alpha: String? = null,
    /** Adjustment carried by this contract. */
    val adjustment: String? = null,
    /** State set id carried by this contract. */
    val stateSetId: String,
)
