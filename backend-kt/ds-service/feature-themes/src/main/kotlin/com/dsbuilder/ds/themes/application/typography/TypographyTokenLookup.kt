package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.ds.themes.domain.ThemeTokenType

/** Результат поиска токена для изменения стиля. */
sealed interface TypographyTokenLookup {
    /** Токен найден в активном черновике: его имя и тип. */
    data class Found(
        /** Полное имя токена. */
        val name: String,
        /** Тип токена или `null`. */
        val type: ThemeTokenType?,
    ) : TypographyTokenLookup

    /** Токена нет в дизайн-системе на выбранной границе. */
    data object Missing : TypographyTokenLookup
}
