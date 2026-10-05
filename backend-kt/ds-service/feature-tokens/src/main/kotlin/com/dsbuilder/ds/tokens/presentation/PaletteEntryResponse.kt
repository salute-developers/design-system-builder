package com.dsbuilder.ds.tokens.presentation

import com.dsbuilder.ds.tokens.domain.PaletteEntry
import kotlinx.serialization.Serializable

/** Legacy-compatible palette response. */
@Serializable
data class PaletteEntryResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Type carried by this contract. */
    val type: String,
    /** Shade carried by this contract. */
    val shade: String,
    /** Saturation carried by this contract. */
    val saturation: Int,
    /** Value carried by this contract. */
    val value: String,
    /** Createdat carried by this contract. */
    val createdAt: String,
    /** Updatedat carried by this contract. */
    val updatedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: PaletteEntry) = PaletteEntryResponse(
            value.id.toString(),
            value.type.wireValue,
            value.shade,
            value.saturation,
            value.value,
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
