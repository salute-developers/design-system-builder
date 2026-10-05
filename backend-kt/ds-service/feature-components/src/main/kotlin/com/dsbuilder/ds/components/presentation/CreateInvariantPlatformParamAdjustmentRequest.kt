package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for invariant adjustment creation. */
@Serializable
data class CreateInvariantPlatformParamAdjustmentRequest(
    /** Ipv id carried by this contract. */
    val ipvId: String,
    /** Platform param id carried by this contract. */
    val platformParamId: String,
    /** Value carried by this contract. */
    val value: String? = null,
    /** Template carried by this contract. */
    val template: String? = null,
)
