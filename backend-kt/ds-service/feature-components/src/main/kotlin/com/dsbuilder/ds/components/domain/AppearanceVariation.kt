package com.dsbuilder.ds.components.domain

import java.time.Instant
import java.util.UUID

/** Variation axis declared for an appearance. */
data class AppearanceVariation(
    /** Id carried by this contract. */
    val id: UUID,
    /** Appearance id carried by this contract. */
    val appearanceId: UUID,
    /** Variation id carried by this contract. */
    val variationId: UUID,
    /** Position carried by this contract. */
    val position: Int,
    /** Default style id carried by this contract. */
    val defaultStyleId: UUID?,
    /** Is color scheme carried by this contract. */
    val isColorScheme: Boolean,
    /** Является ли ось корневой у своего appearance. */
    val isRoot: Boolean,
    /** Declared type carried by this contract. */
    val declaredType: String?,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
)
