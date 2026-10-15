package com.dsbuilder.ds.designsystems.domain

/** Результат попытки отката вычисленного изменения. */
sealed interface DraftChangeRevertResult {
    /** Изменение успешно отменено. */
    data object Reverted : DraftChangeRevertResult

    /** Изменение или дизайн-система не найдены. */
    data object NotFound : DraftChangeRevertResult

    /** Запрошенное изменение уже изменилось повторно. */
    data class Stale(
        /** Актуальная техническая редакция. */
        val currentRevision: Long,
    ) : DraftChangeRevertResult

    /** Созданную сущность нельзя удалить из-за действующей зависимости. */
    data object DependencyConflict : DraftChangeRevertResult
}
