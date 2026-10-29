package com.dsbuilder.ds.tokens.application

import com.dsbuilder.ds.tokens.domain.TokenMode
import com.dsbuilder.ds.tokens.domain.TokenPlatform
import kotlinx.serialization.json.JsonElement
import java.util.UUID

/** Validated input for creating a token value. */
data class CreateTokenValue(
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
)
