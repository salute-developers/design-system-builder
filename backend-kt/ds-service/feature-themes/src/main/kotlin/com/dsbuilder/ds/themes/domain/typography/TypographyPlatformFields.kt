package com.dsbuilder.ds.themes.domain.typography

/** Поля значения одной платформы в единицах редактора; `null` — поля в значении нет. */
data class TypographyPlatformFields(
    /** Размер в px. */
    val sizePx: Double?,
    /** Высота строки в px. */
    val lineHeightPx: Double?,
    /** Трекинг в em. */
    val letterSpacingEm: Double?,
    /** Вес числом. */
    val weight: Int?,
) {
    /** Значение поля [field] как число. */
    fun of(field: TypographyField): Double? = when (field) {
        TypographyField.SIZE -> sizePx
        TypographyField.LINE_HEIGHT -> lineHeightPx
        TypographyField.LETTER_SPACING -> letterSpacingEm
        TypographyField.WEIGHT -> weight?.toDouble()
    }
}
