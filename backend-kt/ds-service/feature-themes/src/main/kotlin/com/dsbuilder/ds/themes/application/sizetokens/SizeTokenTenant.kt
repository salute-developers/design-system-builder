package com.dsbuilder.ds.themes.application.sizetokens

import java.util.UUID

/** Тема, доступная проекту для чтения токенов размеров на границе контекста. */
data class SizeTokenTenant(
    /** Дизайн-система темы. */
    val designSystemId: UUID,
    /** Дизайн-система принадлежит проекту, а не общая. */
    val owned: Boolean,
)
