package com.dsbuilder.ds.designsystems.presentation

import kotlinx.serialization.Serializable

/** Legacy-compatible create-design-system payload. */
@Serializable
data class CreateDesignSystemRequest(
    /** Name carried by this contract. */
    val name: String,
    /** Project name carried by this contract. */
    val projectName: String,
    /** Project id carried by this contract. */
    val projectId: String? = null,
    /** Description carried by this contract. */
    val description: String? = null,
)
