package com.dsbuilder.ds.components.domain

import java.time.Instant
import java.util.UUID

/** Reusable component catalog entry. */
data class Component(
    /** Id carried by this contract. */
    val id: UUID,
    /** Name carried by this contract. */
    val name: String,
    /** Platform the component belongs to: `web`, `compose`, `xml` or `ios`. */
    val platform: String,
    /** Description carried by this contract. */
    val description: String?,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
)
