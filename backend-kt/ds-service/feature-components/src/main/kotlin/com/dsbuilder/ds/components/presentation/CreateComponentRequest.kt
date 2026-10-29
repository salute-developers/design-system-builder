package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Component creation payload. */
@Serializable
data class CreateComponentRequest(
    /** Name carried by this contract. */
    val name: String,
    /** Platform of the component; part of its identity together with the name. */
    val platform: String,
    /** Description carried by this contract. */
    val description: String? = null,
)
