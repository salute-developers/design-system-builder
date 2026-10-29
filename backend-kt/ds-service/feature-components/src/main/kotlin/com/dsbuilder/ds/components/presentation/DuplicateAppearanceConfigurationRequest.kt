package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Тело запроса дублирования конфигурации. */
@Serializable
data class DuplicateAppearanceConfigurationRequest(
    /** Имя копии; без значения оно формируется. */
    val name: String? = null,
)
