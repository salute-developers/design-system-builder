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

    /** Изменение без полей [fields]: их значения у платформы свои и правкой веба не перезаписываются. */
    fun without(fields: Set<TypographyField>): TypographyTokenChange = copy(
        sizePx = sizePx.takeUnless { TypographyField.SIZE in fields },
        lineHeightPx = lineHeightPx.takeUnless { TypographyField.LINE_HEIGHT in fields },
        letterSpacingEm = letterSpacingEm.takeUnless { TypographyField.LETTER_SPACING in fields },
        weight = weight.takeUnless { TypographyField.WEIGHT in fields },
    )
}
