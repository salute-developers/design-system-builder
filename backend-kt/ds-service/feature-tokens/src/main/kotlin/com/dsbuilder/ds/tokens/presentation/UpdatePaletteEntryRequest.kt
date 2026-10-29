package com.dsbuilder.ds.tokens.presentation

import kotlinx.serialization.Serializable

/** Legacy-compatible palette patch payload. */
@Serializable
data class UpdatePaletteEntryRequest(/** Value carried by this contract. */ val value: String? = null)
