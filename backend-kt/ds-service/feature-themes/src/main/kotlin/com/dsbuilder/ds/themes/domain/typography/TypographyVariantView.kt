package com.dsbuilder.ds.themes.domain.typography

import java.util.UUID

/** Начертание стиля: токен и вес. */
data class TypographyVariantView(
    /** Идентификатор токена начертания на экране. */
    val tokenId: UUID,
    /** Вес числом. */
    val weight: Int,
)
