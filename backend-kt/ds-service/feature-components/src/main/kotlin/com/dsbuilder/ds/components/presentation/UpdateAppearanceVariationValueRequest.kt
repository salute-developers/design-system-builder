package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for appearance variation value patching. */
@Serializable
data class UpdateAppearanceVariationValueRequest(
    /** Position carried by this contract. */
    val position: Int? = null,
    /** Authored id carried by this contract. */
    val authoredId: String? = null,
)
