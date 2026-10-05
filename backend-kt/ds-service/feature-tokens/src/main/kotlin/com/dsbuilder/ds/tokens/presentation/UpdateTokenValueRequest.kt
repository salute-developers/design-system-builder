package com.dsbuilder.ds.tokens.presentation

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Legacy-compatible token-value patch payload. */
@Serializable
data class UpdateTokenValueRequest(
    /** Paletteid carried by this contract. */
    val paletteId: String? = null,
    /** Platform carried by this contract. */
    val platform: String? = null,
    /** Mode carried by this contract. */
    val mode: String? = null,
    /** Value carried by this contract. */
    val value: JsonElement? = null,
)
