package com.dsbuilder.ds.designsystems.domain

import java.time.Instant
import java.util.UUID

/** Component fields exposed by the design-system aggregate endpoint. */
data class DesignSystemComponentSummary(
    /** Id carried by this contract. */
    val id: UUID,
    /** Name carried by this contract. */
    val name: String,
    /** Description carried by this contract. */
    val description: String?,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
)
