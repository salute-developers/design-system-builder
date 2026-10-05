package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for variation adjustment creation. */
@Serializable
data class CreateVariationPlatformParamAdjustmentRequest(
    /** Vpv id carried by this contract. */
    val vpvId: String,
    /** Platform param id carried by this contract. */
    val platformParamId: String,
    /** Value carried by this contract. */
    val value: String? = null,
    /** Template carried by this contract. */
    val template: String? = null,
)
