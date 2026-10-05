package com.dsbuilder.ds.designsystems.domain

import java.time.Instant
import java.util.UUID

/** Style fields exposed by the design-system component aggregate endpoint. */
data class DesignSystemStyleSummary(
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
