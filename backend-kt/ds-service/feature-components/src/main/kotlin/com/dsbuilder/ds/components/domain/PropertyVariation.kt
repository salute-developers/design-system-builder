package com.dsbuilder.ds.components.domain

import java.time.Instant
import java.util.UUID

/** Link declaring that a property belongs to a variation. */
data class PropertyVariation(
    /** Id carried by this contract. */
    val id: UUID,
    /** Property id carried by this contract. */
    val propertyId: UUID,
    /** Variation id carried by this contract. */
    val variationId: UUID,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
)
