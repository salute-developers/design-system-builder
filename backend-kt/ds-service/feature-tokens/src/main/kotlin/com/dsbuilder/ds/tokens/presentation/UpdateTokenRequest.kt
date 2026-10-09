package com.dsbuilder.ds.tokens.presentation

import kotlinx.serialization.Serializable

/** Legacy-compatible token patch payload. */
@Serializable
data class UpdateTokenRequest(
    /** Name carried by this contract. */
    val name: String? = null,
    /** Type carried by this contract. */
    val type: String? = null,
    /** Displayname carried by this contract. */
    val displayName: String? = null,
    /** Description carried by this contract. */
    val description: String? = null,
    /** Enabled carried by this contract. */
    val enabled: Boolean? = null,
)
