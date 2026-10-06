package com.dsbuilder.ds.components.domain

import java.time.Instant
import java.util.UUID

/** Component appearance in a design system. */
data class Appearance(
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
