package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for appearance variation axis patching. */
@Serializable
data class UpdateAppearanceVariationRequest(
    /** Position carried by this contract. */
    val position: Int? = null,
    /** Default style id carried by this contract. */
    val defaultStyleId: String? = null,
    /** Is color scheme carried by this contract. */
    val isColorScheme: Boolean? = null,
    /** Declared type carried by this contract. */
    val declaredType: String? = null,
)
