package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Component dependency creation payload. */
@Serializable
data class CreateComponentDependencyRequest(
    /** Parent id carried by this contract. */
    val parentId: String,
    /** Child id carried by this contract. */
    val childId: String,
    /** Type carried by this contract. */
    val type: String,
    /** Order carried by this contract. */
    val order: Int? = null,
)
