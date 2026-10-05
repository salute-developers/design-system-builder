package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for property platform-param patching. */
@Serializable
data class UpdatePropertyPlatformParamRequest(
    /** Platform carried by this contract. */
    val platform: String? = null,
    /** Name carried by this contract. */
    val name: String? = null,
)
