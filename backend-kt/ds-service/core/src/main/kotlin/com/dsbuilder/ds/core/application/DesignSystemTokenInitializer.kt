package com.dsbuilder.ds.core.application

import java.util.UUID

/** Инициализирует эталонные определения токенов новой дизайн-системы. */
interface DesignSystemTokenInitializer {
    /** Создаёт отсутствующие определения токенов для [designSystemId]. */
    suspend fun initialize(designSystemId: UUID)
}
