package com.dsbuilder.ds.core.domain

import java.time.Instant

/** Последнее изменение отдельного предметного пути. */
data class EntityEditPath(
    /** Изменённый предметный путь в формате JSON Pointer. */
    val path: String,
    /** Техническая редакция последнего изменения пути. */
    val lastRevision: Long,
    /** Автор последнего изменения пути. */
    val lastActorId: String,
    /** Время последнего изменения пути. */
    val updatedAt: Instant,
)
