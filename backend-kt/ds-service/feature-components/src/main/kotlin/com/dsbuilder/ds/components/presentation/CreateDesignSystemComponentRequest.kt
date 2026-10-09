package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Design-system component link payload. */
@Serializable
data class CreateDesignSystemComponentRequest(
    /** Design system id carried by this contract. */
    val designSystemId: String,
    /** Component id carried by this contract. */
    val componentId: String,
)
