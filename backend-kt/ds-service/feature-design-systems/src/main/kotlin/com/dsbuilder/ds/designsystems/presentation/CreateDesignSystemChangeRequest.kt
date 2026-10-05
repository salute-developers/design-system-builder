package com.dsbuilder.ds.designsystems.presentation

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Legacy-compatible change-entry creation payload. */
@Serializable
data class CreateDesignSystemChangeRequest(
    /** Design system id carried by this contract. */
    val designSystemId: String,
    /** Entity type carried by this contract. */
    val entityType: String,
    /** Entity id carried by this contract. */
    val entityId: String,
    /** Operation carried by this contract. */
    val operation: String,
    /** Data carried by this contract. */
    val data: JsonElement? = null,
)
