package com.dsbuilder.ds.themes.application.colortokens

/** Результат поиска семейства цветового токена по идентификатору члена. */
sealed interface ColorTokenLookup {
    /** Токен найден и входит в семейство. */
    data class Found(
        /** Семейство с членами. */
        val stored: StoredColorTokenFamily,
    ) : ColorTokenLookup

    /** Токен есть в дизайн-системе, но его тип или имя не образуют семейство цветового токена. */
    data object OutsideFamily : ColorTokenLookup

    /** Токена нет в дизайн-системе. */
    data object Missing : ColorTokenLookup
}
