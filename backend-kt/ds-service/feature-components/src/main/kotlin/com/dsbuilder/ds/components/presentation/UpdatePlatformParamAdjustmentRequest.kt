package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Shared HTTP patch body for variation and invariant adjustments. */
@Serializable
data class UpdatePlatformParamAdjustmentRequest(
    /** Value carried by this contract. */
    val value: String? = null,
    /** Template carried by this contract. */
    val template: String? = null,
)
