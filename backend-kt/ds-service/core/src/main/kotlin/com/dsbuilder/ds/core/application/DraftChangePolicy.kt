package com.dsbuilder.ds.core.application

import java.util.UUID

/** Предметная политика представления вычисленных изменений в журнале. */
fun interface DraftChangePolicy {
    /** Гарантирует, что политика может скрыть дочерние записи, но не весь непустой журнал. */
    val preservesNonEmpty: Boolean
        get() = false

    /** Возвращает изменения, которые должны быть видимы пользователю. */
    fun visible(versionId: UUID, candidates: List<DraftChangeCandidate>): List<DraftChangeCandidate>
}
