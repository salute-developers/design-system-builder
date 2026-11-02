package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentEditorBundle
import com.dsbuilder.ds.components.domain.ComponentEditorPlatform
import com.dsbuilder.ds.core.domain.ProjectId
import java.util.UUID

/** Порт чтения пакета данных компонента для редактора. Вызывается внутри read-only транзакции. */
interface ComponentEditorBundleRepository {
    /**
     * Читает пакет компонента [componentId] в дизайн-системе [designSystemId].
     *
     * Выбранная версия берётся из транзакции (`ds.version_id`).
     */
    suspend fun load(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: UUID,
        componentId: UUID,
        platform: ComponentEditorPlatform,
    ): LoadAttempt

    /** Результат чтения пакета. */
    sealed interface LoadAttempt {
        /** Пакет прочитан. */
        data class Success(/** Пакет компонента. */ val value: ComponentEditorBundle) : LoadAttempt

        /** Дизайн-система или компонент недоступны, компонент не привязан к ней или другой платформы. */
        data object NotFound : LoadAttempt

        /** Выгрузка конфигураций отказала так же, как `POST /api/ds/component-config/export`. */
        data class Failed(/** Причина отказа выгрузки. */ val reason: String) : LoadAttempt
    }
}
