package com.dsbuilder.ds.core.application

/** Кандидат вычисляемого журнала до предметного оформления для пользователя. */
data class DraftChangeCandidate(
    /** Тип предметной сущности. */
    val entityType: String,
    /** Вычисленная разница предметной сущности. */
    val change: DraftSubjectChange,
)
