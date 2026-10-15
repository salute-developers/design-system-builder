package com.dsbuilder.ds.core.application

import com.dsbuilder.ds.core.domain.DraftBoundaryRef
import com.dsbuilder.ds.core.domain.EntityEditPath
import com.dsbuilder.ds.core.domain.EntityEditState
import com.dsbuilder.ds.core.domain.LogicalEntityRef

/** Технические редакции сущностей и изменяемых путей активного черновика. */
interface EntityEditStateRepository {
    /** Создаёт при необходимости и блокирует состояние одной сущности до завершения транзакции. */
    suspend fun lock(boundary: DraftBoundaryRef, entity: LogicalEntityRef, actorId: String): EntityEditState

    /** Блокирует несколько сущностей в устойчивом порядке. */
    suspend fun lockAll(
        boundary: DraftBoundaryRef,
        entities: Collection<LogicalEntityRef>,
        actorId: String,
    ): List<EntityEditState> = entities.distinct().sorted().map { lock(boundary, it, actorId) }

    /** Возвращает пути, изменённые позднее указанной технической редакции. */
    suspend fun changedPathsSince(
        boundary: DraftBoundaryRef,
        entity: LogicalEntityRef,
        revision: Long,
    ): List<EntityEditPath>

    /** Увеличивает редакцию заблокированной сущности и отмечает изменённые пути. */
    suspend fun advance(
        boundary: DraftBoundaryRef,
        entity: LogicalEntityRef,
        paths: Set<String>,
        actorId: String,
    ): EntityEditState
}
