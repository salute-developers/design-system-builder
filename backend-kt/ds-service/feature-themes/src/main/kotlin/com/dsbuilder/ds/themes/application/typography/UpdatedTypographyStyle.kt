package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.ds.themes.domain.typography.TypographyStyleView

/** Итог изменения стиля. */
data class UpdatedTypographyStyle(
    /** Новая ревизия темы. */
    val editRevision: Int,
    /** Стиль на экране токена из запроса в формате чтения. */
    val style: TypographyStyleView,
    /** Записанные значения токенов. */
    val tokens: List<WrittenTypographyToken>,
)
