package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for appearance variation axis creation. */
@Serializable
data class CreateAppearanceVariationRequest(
    /** Appearance id carried by this contract. */
    val appearanceId: String,
    /** Variation id carried by this contract. */
    val variationId: String,
    /** Position carried by this contract. */
    val position: Int,
    /** Default style id carried by this contract. */
    val defaultStyleId: String? = null,
    /** Is color scheme carried by this contract. */
    val isColorScheme: Boolean = false,
    /** Делает ось корневой у appearance. */
    val isRoot: Boolean = false,
    /** Declared type carried by this contract. */
    val declaredType: String? = null,
)
