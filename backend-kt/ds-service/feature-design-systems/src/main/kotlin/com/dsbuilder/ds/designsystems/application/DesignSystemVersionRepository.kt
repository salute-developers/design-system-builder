package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.application.ModelReadItems
import com.dsbuilder.ds.core.application.ModelReadQuery
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersion
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionId

/** Хранилище опубликованных временных границ и команды публикации. */
interface DesignSystemVersionRepository {
    /** Возвращает доступные проекту публикации. */
    suspend fun list(projectId: ProjectId): List<DesignSystemVersion>

    /** Находит доступную проекту публикацию. */
    suspend fun find(projectId: ProjectId, id: DesignSystemVersionId): DesignSystemVersion?

    /** Возвращает публикации одной доступной дизайн-системы. */
    suspend fun listByDesignSystem(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
    ): List<DesignSystemVersion>?

    /** Публикации с серверным фильтром и необязательной пагинацией. */
    suspend fun pageByDesignSystem(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
        read: ModelReadQuery,
    ): ModelReadItems<DesignSystemVersion>? = listByDesignSystem(projectId, designSystemId)?.let { ModelReadItems(it) }

    /** Публикует активный черновик одной транзакцией. */
    suspend fun publish(projectId: ProjectId, command: CreateDesignSystemVersion): PublishDesignSystemResult
}
