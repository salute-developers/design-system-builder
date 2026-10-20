package com.dsbuilder.ds.themes.domain.typography

/** Изменение значения одного токена стиля; `null` — поле не меняется. */
data class TypographyTokenChange(
    /** Размер в px. */
    val sizePx: Double? = null,
    /** Высота строки в px. */
    val lineHeightPx: Double? = null,
    /** Трекинг в em. */
    val letterSpacingEm: Double? = null,
    /** Вес: 100…900 с шагом 100. */
    val weight: Int? = null,
    /** Имя токена `fontFamily` без префикса. */
    val fontFamily: String? = null,
) {
    /** Изменение ничего не меняет. */
    val isEmpty: Boolean
        get() = this == TypographyTokenChange()
}
