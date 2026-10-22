package com.dsbuilder.ds.core.domain

import java.time.Instant

/** Заблокированное техническое состояние логической сущности. */
data class EntityEditState(
    /** Черновик, внутри которого действует редакция. */
    val boundary: DraftBoundaryRef,
    /** Логическая сущность, к которой относится редакция. */
    val entity: LogicalEntityRef,
    /** Текущий номер технической редакции. */
    val revision: Long,
    /** Автор последней успешно сохранённой записи. */
    val lastActorId: String,
    /** Время последней успешно сохранённой записи. */
    val updatedAt: Instant,
)
