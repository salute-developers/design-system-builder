package com.dsbuilder.ds.themes.application.typography

import java.util.UUID

/** Итог разделяемой блокировки дизайн-системы темы перед изменением стиля. */
sealed interface TypographyStyleLock {
    /** Тема найдена в активном черновике, запись согласована с публикацией. */
    data class Locked(
        /** Дизайн-система темы. */
        val designSystemId: UUID,
    ) : TypographyStyleLock

    /** Темы нет в активном черновике или она принадлежит другому проекту. */
    data object NotFound : TypographyStyleLock
}
