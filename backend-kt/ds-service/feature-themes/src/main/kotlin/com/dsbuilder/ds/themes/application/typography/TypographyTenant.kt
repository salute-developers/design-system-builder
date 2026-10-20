package com.dsbuilder.ds.themes.application.typography

import java.util.UUID

/** Тема для чтения стилей. */
data class TypographyTenant(
    /** Дизайн-система темы. */
    val designSystemId: UUID,
    /** Текущая ревизия темы. */
    val editRevision: Int,
)
