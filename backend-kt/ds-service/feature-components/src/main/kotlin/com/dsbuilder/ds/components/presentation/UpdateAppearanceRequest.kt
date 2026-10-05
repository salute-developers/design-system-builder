package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for appearance patching. */
@Serializable
data class UpdateAppearanceRequest(
    /** Name carried by this contract. */
    val name: String? = null,
    /** Platform carried by this contract. */
    val platform: String? = null,
)
