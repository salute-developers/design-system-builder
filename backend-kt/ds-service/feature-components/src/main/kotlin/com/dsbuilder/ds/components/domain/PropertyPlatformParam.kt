package com.dsbuilder.ds.components.domain

import java.time.Instant
import java.util.UUID

/** Platform-specific source name for a component property. */
data class PropertyPlatformParam(
    /** Id carried by this contract. */
    val id: UUID,
    /** Property id carried by this contract. */
    val propertyId: UUID,
    /** Platform carried by this contract. */
    val platform: String,
    /** Name carried by this contract. */
    val name: String,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
)
