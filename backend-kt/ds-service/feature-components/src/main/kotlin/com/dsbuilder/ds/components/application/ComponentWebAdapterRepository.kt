package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentWebAdapterEntry
import com.dsbuilder.ds.core.domain.ProjectId
import java.util.UUID

/** Порт чтения web-адаптера дизайн-системы. */
interface ComponentWebAdapterRepository {
    /**
     * Читает записи web-адаптера, упорядоченные по `componentName`.
     *
     * Возвращает `null`, когда дизайн-система не существует или недоступна проекту.
     */
    suspend fun load(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: UUID,
    ): List<ComponentWebAdapterEntry>?

    /**
     * Читает запись web-адаптера одного компонента по его имени в базе (`name`).
     *
     * Запись совпадает с записью того же компонента в ответе [load]. Возвращает `null`, когда дизайн-система
     * недоступна или у компонента нет записи.
     */
    suspend fun loadComponent(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: UUID,
        componentName: String,
    ): ComponentWebAdapterEntry? =
        load(projectId, systemAdmin, designSystemId)?.firstOrNull { it.name == componentName }
}
