package com.dsbuilder.ds.tokens.application

import com.dsbuilder.ds.tokens.domain.PaletteType

/** Validated input for a global palette entry. */
data class CreatePaletteEntry(
    /** Type carried by this contract. */
    val type: PaletteType,
    /** Shade carried by this contract. */
    val shade: String,
    /** Saturation carried by this contract. */
    val saturation: Int,
    /** Value carried by this contract. */
    val value: String,
)
