package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for component style patching. */
@Serializable
data class UpdateStyleRequest(
    /** Name carried by this contract. */
    val name: String? = null,
    /** Description carried by this contract. */
    val description: String? = null,
)
