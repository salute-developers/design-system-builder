package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Тело запроса создания пустой конфигурации компонента. */
@Serializable
data class CreateAppearanceConfigurationRequest(
    /** Дизайн-система. */
    val designSystemId: String,
    /** Компонент. */
    val componentId: String,
    /** Имя конфигурации; без значения оно формируется. */
    val name: String? = null,
)
