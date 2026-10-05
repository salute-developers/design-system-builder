package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Component reuse configuration patch payload. */
@Serializable
data class UpdateComponentReuseConfigRequest(
    /** Appearance id carried by this contract. */
    val appearanceId: String? = null,
    /** Variation id carried by this contract. */
    val variationId: String? = null,
    /** Style id carried by this contract. */
    val styleId: String? = null,
)
