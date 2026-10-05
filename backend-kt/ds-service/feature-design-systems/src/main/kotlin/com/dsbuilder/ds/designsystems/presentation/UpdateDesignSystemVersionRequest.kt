package com.dsbuilder.ds.designsystems.presentation

import kotlinx.serialization.Serializable

/** Legacy-compatible version update payload. */
@Serializable
data class UpdateDesignSystemVersionRequest(
    /** Changelog carried by this contract. */
    val changelog: String? = null,
    /** Publication status carried by this contract. */
    val publicationStatus: String? = null,
)
