package com.dsbuilder.ds.components.domain

import java.time.Instant
import java.util.UUID

/** Declared value of an appearance variation axis. */
data class AppearanceVariationValue(
    /** Id carried by this contract. */
    val id: UUID,
    /** Appearance variation id carried by this contract. */
    val appearanceVariationId: UUID,
    /** Style id carried by this contract. */
    val styleId: UUID,
    /** Position carried by this contract. */
    val position: Int,
    /** Authored id carried by this contract. */
    val authoredId: String?,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
)
