package com.dsbuilder.ds.core.application

import java.time.Instant
import java.util.UUID

/** Сигнал о том, что активный черновик изменился и клиенту требуется перечитать предметные данные. */
data class DraftInvalidation(
    /** Дизайн-система, состояние которой изменилось. */
    val designSystemId: UUID,
    /** Активный черновик после изменения. */
    val draftId: UUID,
    /** Общая редакция активного черновика после изменения. */
    val draftRevision: Long?,
    /** Автор подтверждённой транзакции. */
    val actorId: String,
    /** Вкладка, отправившая изменение, если запрос пришёл из редактора. */
    val clientId: String?,
    /** Время формирования уведомления внутри транзакции. */
    val changedAt: Instant,
    /** Объединённые области данных, изменённые одной транзакцией. */
    val scopes: Set<DraftInvalidationScope>,
    /** Идентичность события, не задающая порядок фиксации транзакций. */
    val eventId: UUID? = null,
)
