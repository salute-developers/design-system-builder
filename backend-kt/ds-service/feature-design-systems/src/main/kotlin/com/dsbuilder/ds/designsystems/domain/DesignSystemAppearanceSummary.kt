package com.dsbuilder.ds.designsystems.domain

import java.time.Instant
import java.util.UUID

/** Appearance fields exposed by the design-system aggregate endpoint. */
data class DesignSystemAppearanceSummary(
    /** Id carried by this contract. */
    val id: UUID,
    /** Design system id carried by this contract. */
    val designSystemId: UUID,
    /** Component id carried by this contract. */
    val componentId: UUID,
    /** Name carried by this contract. */
    val name: String?,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
)
