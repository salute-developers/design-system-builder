package com.dsbuilder.ds.themes.presentation.typography

import kotlinx.serialization.Serializable

/** Ответ создания стиля; технические редакции — в `X-DS-Mutation-Metadata`. */
@Serializable
data class CreatedTypographyStyleResponse(
    /** Идентификаторы девяти токенов стиля. */
    val tokenIds: List<String>,
    /** Новый стиль на каждом экране в формате чтения. */
    val screens: List<TypographyScreenDto>,
)
