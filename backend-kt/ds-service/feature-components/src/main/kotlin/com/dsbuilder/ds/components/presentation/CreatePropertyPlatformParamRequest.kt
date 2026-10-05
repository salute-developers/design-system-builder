package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for property platform-param creation. */
@Serializable
data class CreatePropertyPlatformParamRequest(
    /** Property id carried by this contract. */
    val propertyId: String,
    /** Platform carried by this contract. */
    val platform: String,
    /** Name carried by this contract. */
    val name: String,
)
