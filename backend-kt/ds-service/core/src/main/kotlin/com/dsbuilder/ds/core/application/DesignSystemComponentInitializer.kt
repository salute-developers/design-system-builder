package com.dsbuilder.ds.core.application

import java.util.UUID

/** Инициализирует компонентные конфигурации новой дизайн-системы. */
interface DesignSystemComponentInitializer {
    /** Создаёт исходные конфигурации для заранее импортированной меты до открытия первого черновика. */
    suspend fun initialize(designSystemId: UUID)
}
