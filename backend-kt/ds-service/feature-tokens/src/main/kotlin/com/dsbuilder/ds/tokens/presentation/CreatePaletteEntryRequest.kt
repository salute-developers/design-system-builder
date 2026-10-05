package com.dsbuilder.ds.tokens.presentation

import kotlinx.serialization.Serializable

/** Legacy-compatible create-palette payload. */
@Serializable
data class CreatePaletteEntryRequest(
    /** Type carried by this contract. */
    val type: String,
    /** Shade carried by this contract. */
    val shade: String,
    /** Saturation carried by this contract. */
    val saturation: Int,
    /** Value carried by this contract. */
    val value: String,
)
