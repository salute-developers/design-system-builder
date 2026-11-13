package com.dsbuilder.ds.themes.presentation.typography

import kotlinx.serialization.Serializable

/** Ответ создания, переименования или удаления стиля; технические редакции — в `X-DS-Mutation-Metadata`. */
@Serializable
data class TypographyStyleTokensResponse(
    /** Идентификаторы девяти токенов стиля. */
    val tokenIds: List<String>,
)
