package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Component dependency patch payload. */
@Serializable
data class UpdateComponentDependencyRequest(
    /** Type carried by this contract. */
    val type: String? = null,
    /** Order carried by this contract. */
    val order: Int? = null,
)
