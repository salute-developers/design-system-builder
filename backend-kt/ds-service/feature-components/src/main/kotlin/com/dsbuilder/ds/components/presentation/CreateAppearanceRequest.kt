package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for appearance creation. */
@Serializable
data class CreateAppearanceRequest(
    /** Design system id carried by this contract. */
    val designSystemId: String,
    /** Component id carried by this contract. */
    val componentId: String,
    /** Name carried by this contract. */
    val name: String = "default",
    /** Accepted for compatibility and ignored: the platform is defined by the component. */
    val platform: String? = null,
)
