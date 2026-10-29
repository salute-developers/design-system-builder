package com.dsbuilder.ds.components.domain

import java.time.Instant
import java.util.UUID

/** Property returned by a nested component read. */
data class ComponentPropertySummary(
    /** Id carried by this contract. */
    val id: UUID,
    /** Component id carried by this contract. */
    val componentId: UUID?,
    /** Name carried by this contract. */
    val name: String,
    /** Type carried by this contract. */
    val type: String,
    /** Default value carried by this contract. */
    val defaultValue: String?,
    /** Description carried by this contract. */
    val description: String?,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
)
