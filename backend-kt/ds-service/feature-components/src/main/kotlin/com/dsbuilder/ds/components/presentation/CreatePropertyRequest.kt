package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for property creation. */
@Serializable
data class CreatePropertyRequest(
    /** Component id carried by this contract. */
    val componentId: String? = null,
    /** Name carried by this contract. */
    val name: String,
    /** Type carried by this contract. */
    val type: String,
    /** Default value carried by this contract. */
    val defaultValue: String? = null,
    /** Description carried by this contract. */
    val description: String? = null,
    /** Accepted for compatibility and ignored: the platform is defined by the component. */
    val platform: String? = null,
)
