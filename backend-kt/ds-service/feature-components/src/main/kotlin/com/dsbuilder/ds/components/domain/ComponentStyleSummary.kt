package com.dsbuilder.ds.components.domain

import java.time.Instant
import java.util.UUID

/** Style returned by a variation lookup. */
data class ComponentStyleSummary(
    /** Id carried by this contract. */
    val id: UUID,
    /** Design system id carried by this contract. */
    val designSystemId: UUID,
    /** Variation id carried by this contract. */
    val variationId: UUID,
    /** Name carried by this contract. */
    val name: String,
    /** Description carried by this contract. */
    val description: String?,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
)
