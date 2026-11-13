package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Design-system component link payload. */
@Serializable
data class CreateDesignSystemComponentRequest(
    /** Component id carried by this contract. */
    val componentId: String,
    /**
     * Собрать компонент без конфигурации в этой дизайн-системе из шаблона `ds-service` вместе с зависимостями.
     * Без флага создаётся или восстанавливается только связь.
     */
    val fromTemplate: Boolean = false,
)
