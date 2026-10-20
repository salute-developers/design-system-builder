package com.dsbuilder.ds.themes.presentation.typography

import kotlinx.serialization.Serializable

/** Ответ изменения стиля. */
@Serializable
data class UpdatedTypographyStyleResponse(
    /** Новая ревизия темы. */
    val editRevision: Int,
    /** Стиль на экране токена из запроса. */
    val style: TypographyStyleDto,
    /** Записанные значения токенов. */
    val tokens: List<TypographyTokenValuesDto>,
)
