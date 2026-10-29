package com.dsbuilder.ds.components.domain

import java.time.Instant
import java.util.UUID

/** Link between a design system and a reusable component. */
data class DesignSystemComponent(
    /** Id carried by this contract. */
    val id: UUID,
    /** Design system id carried by this contract. */
    val designSystemId: UUID,
    /** Component id carried by this contract. */
    val componentId: UUID,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
)
