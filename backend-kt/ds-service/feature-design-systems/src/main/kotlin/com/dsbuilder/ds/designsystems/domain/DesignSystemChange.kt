package com.dsbuilder.ds.designsystems.domain

import java.time.Instant
import java.util.UUID

/** Audit entry associated with a design system. */
data class DesignSystemChange(
    /** Id carried by this contract. */
    val id: UUID,
    /** Design system id carried by this contract. */
    val designSystemId: DesignSystemId,
    /** Entity type carried by this contract. */
    val entityType: String,
    /** Entity id carried by this contract. */
    val entityId: UUID,
    /** Operation carried by this contract. */
    val operation: ChangeOperation,
    /** Data json carried by this contract. */
    val dataJson: String?,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
)
