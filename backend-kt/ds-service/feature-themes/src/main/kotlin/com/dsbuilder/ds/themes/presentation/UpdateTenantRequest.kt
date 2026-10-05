package com.dsbuilder.ds.themes.presentation

import kotlinx.serialization.Serializable

/** Legacy-compatible update-tenant payload. */
@Serializable
data class UpdateTenantRequest(
    /** Name carried by this contract. */
    val name: String? = null,
    /** Description carried by this contract. */
    val description: String? = null,
    /** Color config carried by this contract. */
    val colorConfig: ColorConfigurationDto? = null,
)
