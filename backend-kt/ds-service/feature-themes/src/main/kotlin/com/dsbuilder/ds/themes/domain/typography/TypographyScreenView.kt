package com.dsbuilder.ds.themes.domain.typography

/** Стили экрана в порядке групп и размеров. */
data class TypographyScreenView(
    /** Экран. */
    val screen: TypographyScreen,
    /** Стили экрана. */
    val styles: List<TypographyStyleView>,
)
