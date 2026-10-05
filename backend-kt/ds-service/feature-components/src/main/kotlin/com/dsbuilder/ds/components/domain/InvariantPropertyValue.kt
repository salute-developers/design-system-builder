package com.dsbuilder.ds.components.domain

import java.time.Instant
import java.util.UUID

/** Property value invariant across styles of one component appearance. */
data class InvariantPropertyValue(
    /** Id carried by this contract. */
    val id: UUID,
    /** Property id carried by this contract. */
    val propertyId: UUID,
    /** Design system id carried by this contract. */
    val designSystemId: UUID,
    /** Component id carried by this contract. */
    val componentId: UUID,
    /** Appearance id carried by this contract. */
    val appearanceId: UUID,
    /** Token id carried by this contract. */
    val tokenId: UUID?,
    /** Value carried by this contract. */
    val value: String?,
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
