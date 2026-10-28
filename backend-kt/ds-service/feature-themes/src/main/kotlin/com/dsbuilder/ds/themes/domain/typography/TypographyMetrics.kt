package com.dsbuilder.ds.themes.domain.typography

/** Значения токена стиля в единицах редактора, прочитанные из значений платформ. */
data class TypographyMetrics(
    /** Размер в px. */
    val sizePx: Double,
    /** Высота строки в px. */
    val lineHeightPx: Double,
    /** Трекинг в em. */
    val letterSpacingEm: Double,
    /** Вес числом. */
    val weight: Int,
    /** Имя токена `fontFamily` без префикса или пустая строка, если ссылки нет. */
    val fontFamily: String,
)
