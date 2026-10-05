package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Component reuse configuration creation payload. */
@Serializable
data class CreateComponentReuseConfigRequest(
    /** Component dep id carried by this contract. */
    val componentDepId: String,
    /** Design system id carried by this contract. */
    val designSystemId: String,
    /** Appearance id carried by this contract. */
    val appearanceId: String,
    /** Variation id carried by this contract. */
    val variationId: String,
    /** Style id carried by this contract. */
    val styleId: String,
)
