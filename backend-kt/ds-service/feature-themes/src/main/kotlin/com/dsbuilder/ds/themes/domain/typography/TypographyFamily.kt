package com.dsbuilder.ds.themes.domain.typography

/** Семейство шрифта дизайн-системы: имя токена `fontFamily` и имя шрифта в текущей теме. */
data class TypographyFamily(
    /** Имя токена без префикса `fontFamily.`. */
    val name: String,
    /** Имя шрифта, например `SB Sans Text`; пустая строка, если в теме его нет. */
    val fontName: String,
)
