package com.dsbuilder.ds.tokens.presentation

import kotlinx.serialization.Serializable

/** Legacy-compatible create-token payload. */
@Serializable
data class CreateTokenRequest(
    /** Designsystemid carried by this contract. */
    val designSystemId: String? = null,
    /** Name carried by this contract. */
    val name: String,
    /** Type carried by this contract. */
    val type: String? = null,
    /** Displayname carried by this contract. */
    val displayName: String? = null,
    /** Description carried by this contract. */
    val description: String? = null,
    /** Enabled carried by this contract. */
    val enabled: Boolean = true,
)
