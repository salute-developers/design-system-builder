package com.dsbuilder.ds.core.application

import java.util.UUID

/** Предварительный отбор типов с редакциями в интервале; неизвестные обработчики сохраняются. */
interface DraftChangeCandidateIndex {
    /** Возвращает надмножество типов с предметными изменениями, не заменяя сравнение и правила видимости. */
    fun populatedTypes(
        designSystemId: UUID,
        sequenceNumber: Long,
        previousSequenceNumber: Long,
        handlers: List<DraftChangeHandler>,
    ): Set<String>
}
