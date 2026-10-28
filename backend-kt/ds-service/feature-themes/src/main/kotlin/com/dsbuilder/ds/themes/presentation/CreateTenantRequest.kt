package com.dsbuilder.ds.themes.presentation

import kotlinx.serialization.Serializable

/** Совместимый с актуальным db-service payload создания темы. */
@Serializable
data class CreateTenantRequest(
    /** Design system id carried by this contract. */
    val designSystemId: String,
    /** Name carried by this contract. */
    val name: String,
    /** Description carried by this contract. */
    val description: String? = null,
    /** Начальный цветовой профиль. */
    val profile: String = "malachite",
    /** Палитра для профиля custom. */
    val customPalette: ColorConfigurationDto.CustomPaletteDto? = null,
    /**
     * Значения, которые заменяют начальные значения профиля для своих комбинаций `tokenId + platform + mode`, в форме
     * значений `PUT /tenants/{id}/token-values`; `baseRevision` при создании не используется.
     */
    val values: List<BatchSaveTenantTokenValuesRequest.Value> = emptyList(),
)
