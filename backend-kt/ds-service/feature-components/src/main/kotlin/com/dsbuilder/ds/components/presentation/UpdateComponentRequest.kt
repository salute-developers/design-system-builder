package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Component patch payload. */
@Serializable
data class UpdateComponentRequest(
    /** Name carried by this contract. */
    val name: String? = null,
    /** Description carried by this contract. */
    val description: String? = null,
)
