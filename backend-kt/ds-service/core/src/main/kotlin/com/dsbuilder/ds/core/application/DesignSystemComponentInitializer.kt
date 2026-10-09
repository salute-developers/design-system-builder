package com.dsbuilder.ds.core.application

import java.util.UUID

/** Инициализирует компонентные конфигурации новой дизайн-системы. */
interface DesignSystemComponentInitializer {
    /** Создаёт конфигурации для заранее импортированных компонентов и свойств. */
    suspend fun initialize(designSystemId: UUID)
}
