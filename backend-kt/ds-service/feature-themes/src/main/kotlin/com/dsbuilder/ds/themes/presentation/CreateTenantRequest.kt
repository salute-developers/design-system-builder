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
)
