package com.dsbuilder.ds.themes.application.sizetokens

import java.util.UUID

/** Итог блокировки тем перед операцией над токеном размеров. */
sealed interface SizeTokenLock {
    /** Темы заблокированы, ревизия текущей темы совпала. */
    data class Locked(
        /** Дизайн-система текущей темы. */
        val designSystemId: UUID,
        /** Заблокированные темы: текущая или все темы дизайн-системы. */
        val tenantIds: List<UUID>,
        /** Текущая ревизия текущей темы. */
        val editRevision: Int,
    ) : SizeTokenLock

    /** Темы нет или она принадлежит другому проекту. */
    data object NotFound : SizeTokenLock

    /** Ревизия текущей темы устарела. */
    data class RevisionConflict(
        /** Текущая ревизия темы. */
        val editRevision: Int,
    ) : SizeTokenLock
}
