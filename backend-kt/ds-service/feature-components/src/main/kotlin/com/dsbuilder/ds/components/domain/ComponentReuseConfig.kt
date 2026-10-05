package com.dsbuilder.ds.components.domain

import java.time.Instant
import java.util.UUID

/** Design-system-specific mapping for a reusable component dependency. */
data class ComponentReuseConfig(
    /** Id carried by this contract. */
    val id: UUID,
    /** Component dep id carried by this contract. */
    val componentDepId: UUID,
    /** Design system id carried by this contract. */
    val designSystemId: UUID,
    /** Appearance id carried by this contract. */
    val appearanceId: UUID,
    /** Variation id carried by this contract. */
    val variationId: UUID,
    /** Style id carried by this contract. */
    val styleId: UUID,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
)
