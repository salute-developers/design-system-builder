package com.dsbuilder.ds.components.domain

import java.time.Instant
import java.util.UUID

/** Canonical conjunction of component and interaction states. */
data class ComponentStateSet(
    /** Id carried by this contract. */
    val id: UUID,
    /** State ids carried by this contract. */
    val stateIds: List<UUID>,
    /** Owner component id carried by this contract. */
    val ownerComponentId: UUID?,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
)
