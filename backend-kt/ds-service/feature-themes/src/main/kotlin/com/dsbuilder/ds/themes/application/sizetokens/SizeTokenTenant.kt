package com.dsbuilder.ds.themes.application.sizetokens

import java.util.UUID

/** Тема, доступная проекту для чтения токенов размеров. */
data class SizeTokenTenant(
    /** Дизайн-система темы. */
    val designSystemId: UUID,
    /** Текущая ревизия темы. */
    val editRevision: Int,
    /** Дизайн-система принадлежит проекту, а не общая. */
    val owned: Boolean,
)
