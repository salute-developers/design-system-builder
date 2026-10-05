package com.dsbuilder.ds.tokens.domain

import java.time.Instant
import java.util.UUID

/** One design token, optionally attached to a globally readable design system. */
data class Token(
    /** Id carried by this contract. */
    val id: UUID,
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
    val enabled: Boolean?,
    /** Createdat carried by this contract. */
    val createdAt: Instant,
    /** Updatedat carried by this contract. */
    val updatedAt: Instant,
)
