package com.dsbuilder.ds.tokens.domain

import java.time.Instant
import java.util.UUID

/** One globally readable palette entry. */
data class PaletteEntry(
    /** Id carried by this contract. */
    val id: UUID,
    /** Type carried by this contract. */
    val type: PaletteType,
    /** Shade carried by this contract. */
    val shade: String,
    /** Saturation carried by this contract. */
    val saturation: Int,
    /** Value carried by this contract. */
    val value: String,
    /** Createdat carried by this contract. */
    val createdAt: Instant,
    /** Updatedat carried by this contract. */
    val updatedAt: Instant,
)
