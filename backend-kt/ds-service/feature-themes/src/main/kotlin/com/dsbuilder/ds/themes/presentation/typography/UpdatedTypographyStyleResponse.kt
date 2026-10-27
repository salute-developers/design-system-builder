package com.dsbuilder.ds.themes.presentation.typography

import kotlinx.serialization.Serializable

/** Ответ изменения стиля; технические редакции записей — в заголовке `X-DS-Mutation-Metadata`. */
@Serializable
data class UpdatedTypographyStyleResponse(
    /** Стиль на экране токена из запроса. */
    val style: TypographyStyleDto,
    /** Записанные значения токенов. */
    val tokens: List<TypographyTokenValuesDto>,
)
