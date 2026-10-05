package com.dsbuilder.ds.tokens.application

import com.dsbuilder.ds.tokens.domain.TokenType
import java.util.UUID

/** Validated input for creating a token. */
data class CreateToken(
    /** Designsystemid carried by this contract. */
    val designSystemId: UUID?,
    /** Name carried by this contract. */
    val name: String,
    /** Type carried by this contract. */
    val type: TokenType?,
    /** Displayname carried by this contract. */
    val displayName: String?,
    /** Description carried by this contract. */
    val description: String?,
    /** Enabled carried by this contract. */
    val enabled: Boolean,
)
