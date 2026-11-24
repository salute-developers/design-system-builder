package com.dsbuilder.ds.themes.presentation

import kotlinx.serialization.Serializable

/** Тело `POST /tenants/{id}/duplicates`: название копии темы. */
@Serializable
data class DuplicateTenantRequest(
    /** Название копии; крайние и повторные пробелы убираются. */
    val name: String,
)
