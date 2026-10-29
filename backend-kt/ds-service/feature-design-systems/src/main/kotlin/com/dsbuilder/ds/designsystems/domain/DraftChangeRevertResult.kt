package com.dsbuilder.ds.designsystems.domain

/** Результат попытки отката вычисленного изменения. */
sealed interface DraftChangeRevertResult {
    /** Изменение успешно отменено. */
    data object Reverted : DraftChangeRevertResult

    /** Указанные параметры не изменены либо не поддерживают отдельную отмену. */
    data object InvalidPaths : DraftChangeRevertResult

    /** Изменение или дизайн-система не найдены. */
    data object NotFound : DraftChangeRevertResult

    /** Запрошенное изменение уже изменилось повторно. */
    data class Stale(
        /** Актуальная техническая редакция. */
        val currentRevision: Long,
    ) : DraftChangeRevertResult

    /** Созданную сущность нельзя удалить из-за действующей зависимости. */
    data object DependencyConflict : DraftChangeRevertResult

    /** Поиск изменения превысил защитный предел публичного журнала. */
    data object LimitExceeded : DraftChangeRevertResult
}
