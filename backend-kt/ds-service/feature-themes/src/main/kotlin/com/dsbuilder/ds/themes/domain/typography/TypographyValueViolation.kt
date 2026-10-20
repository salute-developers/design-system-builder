package com.dsbuilder.ds.themes.domain.typography

/** Нарушение правила значения стиля: поле запроса и текст для пользователя. */
data class TypographyValueViolation(
    /** Поле запроса: `size`, `lineHeight`, `letterSpacing`, `weights.bold`, `fontFamily`. */
    val field: String,
    /** Текст ошибки. */
    val message: String,
)
