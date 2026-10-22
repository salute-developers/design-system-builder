package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.ds.themes.domain.typography.TypographyStyleView

/** Итог изменения стиля; технические редакции записей возвращает транзакция в метаданных мутации. */
data class UpdatedTypographyStyle(
    /** Стиль на экране токена из запроса в формате чтения; `components` пуст: использование от правки не меняется. */
    val style: TypographyStyleView,
    /** Записанные значения токенов. */
    val tokens: List<WrittenTypographyToken>,
)
