package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for appearance patching. */
@Serializable
data class UpdateAppearanceRequest(
    /** Name carried by this contract. */
    val name: String? = null,
    /** Accepted for compatibility and ignored: the platform is defined by the component. */
    val platform: String? = null,
)
