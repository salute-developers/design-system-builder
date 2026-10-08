package com.dsbuilder.ds.themes.application.palette

/** Итог блокировки темы перед изменением палитры. */
sealed interface TenantPaletteLock {
    /** Тема заблокирована, ревизия совпала. */
    data object Locked : TenantPaletteLock

    /** Темы нет или она принадлежит другому проекту. */
    data object NotFound : TenantPaletteLock

    /** Ревизия устарела. */
    data class RevisionConflict(
        /** Текущая ревизия темы. */
        val editRevision: Int,
    ) : TenantPaletteLock
}
