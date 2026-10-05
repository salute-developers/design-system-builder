package com.dsbuilder.ds.components.domain

import java.time.Instant
import java.util.UUID

/** Style participating in a style combination. */
data class StyleCombinationMember(
    /** Id carried by this contract. */
    val id: UUID,
    /** Combination id carried by this contract. */
    val combinationId: UUID,
    /** Style id carried by this contract. */
    val styleId: UUID,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
)
