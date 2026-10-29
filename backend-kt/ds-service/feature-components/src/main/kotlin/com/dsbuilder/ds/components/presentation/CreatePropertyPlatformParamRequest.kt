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
    /** Whether the platform name is deprecated; defaults to `false`. */
    val deprecated: Boolean? = null,
    /** Deprecation message; an empty string means deprecated without text. */
    val deprecatedMessage: String? = null,
)
