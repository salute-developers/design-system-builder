package com.dsbuilder.ds.themes.application.typography

import java.util.UUID

/** Итог блокировки темы перед изменением стиля. */
sealed interface TypographyStyleLock {
    /** Тема заблокирована, ревизия совпала. */
    data class Locked(
        /** Дизайн-система темы. */
        val designSystemId: UUID,
    ) : TypographyStyleLock

    /** Темы нет или она принадлежит другому проекту. */
    data object NotFound : TypographyStyleLock

    /** Ревизия темы устарела. */
    data class RevisionConflict(
        /** Текущая ревизия темы. */
        val editRevision: Int,
    ) : TypographyStyleLock
}
