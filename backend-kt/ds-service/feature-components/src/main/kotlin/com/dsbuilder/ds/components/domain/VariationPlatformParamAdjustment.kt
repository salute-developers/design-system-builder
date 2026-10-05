package com.dsbuilder.ds.components.domain

import java.time.Instant
import java.util.UUID

/** Platform override attached to a variation property value. */
data class VariationPlatformParamAdjustment(
    /** Id carried by this contract. */
    val id: UUID,
    /** Vpv id carried by this contract. */
    val vpvId: UUID,
    /** Platform param id carried by this contract. */
    val platformParamId: UUID,
    /** Value carried by this contract. */
    val value: String?,
    /** Template carried by this contract. */
    val template: String?,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
)
