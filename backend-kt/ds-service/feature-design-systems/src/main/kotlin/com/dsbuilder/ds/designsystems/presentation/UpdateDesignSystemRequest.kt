package com.dsbuilder.ds.designsystems.presentation

import kotlinx.serialization.Serializable

/** Legacy-compatible partial design-system payload. */
@Serializable
data class UpdateDesignSystemRequest(
    /** Name carried by this contract. */
    val name: String? = null,
    /** Project id carried by this contract. */
    val projectId: String? = null,
    /** Description carried by this contract. */
    val description: String? = null,
)
