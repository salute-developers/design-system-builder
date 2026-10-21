package com.dsbuilder.ds.themes.presentation.typography

import kotlinx.serialization.Serializable

/** Начертание стиля. */
@Serializable
data class TypographyVariantDto(
    /** Идентификатор токена начертания. */
    val tokenId: String,
    /** Вес числом. */
    val weight: Int,
    /** Технические редакции значений токена по платформам. */
    val valueRevisions: List<TypographyValueRevisionDto>,
)
