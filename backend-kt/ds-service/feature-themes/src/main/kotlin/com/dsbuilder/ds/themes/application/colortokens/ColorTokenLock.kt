package com.dsbuilder.ds.themes.application.colortokens

import java.util.UUID

/** Итог блокировки тем перед операцией над цветовым токеном. */
sealed interface ColorTokenLock {
    /** Темы заблокированы, ревизия текущей темы совпала. */
    data class Locked(
        /** Дизайн-система текущей темы. */
        val designSystemId: UUID,
        /** Заблокированные темы: текущая или все темы дизайн-системы. */
        val tenantIds: List<UUID>,
        /** Текущая ревизия текущей темы. */
        val editRevision: Int,
    ) : ColorTokenLock

    /** Темы нет или она принадлежит другому проекту. */
    data object NotFound : ColorTokenLock

    /** Ревизия текущей темы устарела. */
    data class RevisionConflict(
        /** Текущая ревизия темы. */
        val editRevision: Int,
    ) : ColorTokenLock
}
