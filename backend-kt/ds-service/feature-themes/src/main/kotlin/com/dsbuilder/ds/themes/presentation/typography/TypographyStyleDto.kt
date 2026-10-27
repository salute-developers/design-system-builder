package com.dsbuilder.ds.themes.presentation.typography

import kotlinx.serialization.Serializable

/** Стиль типографии на экране. */
@Serializable
data class TypographyStyleDto(
    /** Экран. */
    val screen: String,
    /** Группа: `display`, `header`, `body`, `text`. */
    val group: String,
    /** Размер внутри группы. */
    val size: String,
    /** Размер в px. */
    val sizePx: Double,
    /** Высота строки в px. */
    val lineHeightPx: Double,
    /** Трекинг в em. */
    val letterSpacingEm: Double,
    /** Имя семейства шрифта. */
    val fontFamily: String,
    /** Начертания: `normal`, `medium`, `bold`. */
    val variants: Map<String, TypographyVariantDto>,
    /** Компоненты, которые используют стиль. */
    val components: List<TypographyComponentDto>,
    /** Свои значения платформ: `ios`, `android` → поля, которые отличаются от веба. */
    val overrides: Map<String, TypographyOverrideDto>,
)
