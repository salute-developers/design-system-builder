package com.dsbuilder.ds.themes.domain.typography

import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform

/** Стиль типографии на экране темы: три начертания с общими размерами. */
data class TypographyStyleView(
    /** Экран. */
    val screen: TypographyScreen,
    /** Стиль без экрана. */
    val key: TypographyStyleKey,
    /** Размер в px. */
    val sizePx: Double,
    /** Высота строки в px. */
    val lineHeightPx: Double,
    /** Трекинг в em. */
    val letterSpacingEm: Double,
    /** Имя семейства шрифта. */
    val fontFamily: String,
    /** Начертания, которые есть у стиля на экране. */
    val variants: Map<TypographyVariant, TypographyVariantView>,
    /** Компоненты, которые используют стиль. */
    val components: List<TypographyComponentUsage>,
    /** Свои значения iOS и Android: только поля, которые отличаются от веба. */
    val overrides: Map<ThemeTokenPlatform, TypographyPlatformOverride> = emptyMap(),
)
