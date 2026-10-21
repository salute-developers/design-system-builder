package com.dsbuilder.ds.themes.domain.typography

import java.util.UUID

/** Начертание стиля: токен, вес и технические редакции его значений. */
data class TypographyVariantView(
    /** Идентификатор токена начертания на экране. */
    val tokenId: UUID,
    /** Вес числом. */
    val weight: Int,
    /** Технические редакции значений токена по платформам. */
    val valueRevisions: List<TypographyValueRevision> = emptyList(),
)
