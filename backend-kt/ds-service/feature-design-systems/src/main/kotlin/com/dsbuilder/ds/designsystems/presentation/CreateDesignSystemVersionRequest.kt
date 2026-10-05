package com.dsbuilder.ds.designsystems.presentation

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Legacy-compatible version creation payload. */
@Serializable
data class CreateDesignSystemVersionRequest(
    /** Design system id carried by this contract. */
    val designSystemId: String,
    /** Version carried by this contract. */
    val version: String,
    /** Snapshot carried by this contract. */
    val snapshot: JsonElement,
    /** Changelog carried by this contract. */
    val changelog: String? = null,
    /** Publication status carried by this contract. */
    val publicationStatus: String? = null,
)
