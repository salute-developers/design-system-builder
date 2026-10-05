package com.dsbuilder.ds.components.domain

import java.time.Instant
import java.util.UUID

/** Property value selected by a canonical combination of styles. */
data class StyleCombination(
    /** Id carried by this contract. */
    val id: UUID,
    /** Property id carried by this contract. */
    val propertyId: UUID,
    /** Appearance id carried by this contract. */
    val appearanceId: UUID,
    /** Combination key carried by this contract. */
    val combinationKey: String,
    /** Value carried by this contract. */
    val value: String,
    /** Token id carried by this contract. */
    val tokenId: UUID?,
    /** Alpha carried by this contract. */
    val alpha: String?,
    /** Adjustment carried by this contract. */
    val adjustment: String?,
    /** Position carried by this contract. */
    val position: Int,
    /** State set id carried by this contract. */
    val stateSetId: UUID,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
)
