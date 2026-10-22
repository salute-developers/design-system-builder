package com.dsbuilder.ds.themes.domain.typography

/** Свои значения платформы у стиля на экране: только поля, которые отличаются от веба. */
data class TypographyPlatformOverride(
    /** Размер в px. */
    val sizePx: Double? = null,
    /** Высота строки в px. */
    val lineHeightPx: Double? = null,
    /** Трекинг в em. */
    val letterSpacingEm: Double? = null,
    /** Веса начертаний, которые отличаются от веба. */
    val weights: Map<TypographyVariant, Int> = emptyMap(),
) {
    /** Переопределённых полей нет. */
    val isEmpty: Boolean
        get() = this == TypographyPlatformOverride()
}
