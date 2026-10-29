package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for appearance variation value creation. */
@Serializable
data class CreateAppearanceVariationValueRequest(
    /** Appearance variation id carried by this contract. */
    val appearanceVariationId: String,
    /** Style id carried by this contract. */
    val styleId: String,
    /** Position carried by this contract. */
    val position: Int,
    /** Authored id carried by this contract. */
    val authoredId: String? = null,
)
