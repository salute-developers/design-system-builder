package com.dsbuilder.ds.tokens.presentation

import com.dsbuilder.ds.tokens.domain.TokenValue
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Legacy-compatible token-value response. */
@Serializable
data class TokenValueResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Tokenid carried by this contract. */
    val tokenId: String?,
    /** Tenantid carried by this contract. */
    val tenantId: String?,
    /** Paletteid carried by this contract. */
    val paletteId: String?,
    /** Platform carried by this contract. */
    val platform: String?,
    /** Mode carried by this contract. */
    val mode: String?,
    /** Value carried by this contract. */
    val value: JsonElement?,
    /** Createdat carried by this contract. */
    val createdAt: String,
    /** Updatedat carried by this contract. */
    val updatedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: TokenValue) = TokenValueResponse(
            value.id.toString(),
            value.tokenId?.toString(),
            value.tenantId?.toString(),
            value.paletteId?.toString(),
            value.platform?.wireValue,
            value.mode?.wireValue,
            value.value,
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
