package com.dsbuilder.ds.tokens.domain

import kotlinx.serialization.json.JsonElement
import java.time.Instant
import java.util.UUID

/** A platform, mode and tenant-specific value of a token. */
data class TokenValue(
    /** Id carried by this contract. */
    val id: UUID,
    /** Tokenid carried by this contract. */
    val tokenId: UUID?,
    /** Tenantid carried by this contract. */
    val tenantId: UUID?,
    /** Paletteid carried by this contract. */
    val paletteId: UUID?,
    /** Platform carried by this contract. */
    val platform: TokenPlatform?,
    /** Mode carried by this contract. */
    val mode: TokenMode?,
    /** Value carried by this contract. */
    val value: JsonElement?,
    /** Createdat carried by this contract. */
    val createdAt: Instant,
    /** Updatedat carried by this contract. */
    val updatedAt: Instant,
)
