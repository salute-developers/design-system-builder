package com.dsbuilder.ds.themes.domain

/** Пользовательская базовая палитра профиля темы. */
data class CustomPalette(
    /** Основной цвет. */
    val primary: String,
    /** Цвет текста на основном цвете. */
    val onPrimary: String,
    /** Цвет фона. */
    val background: String,
    /** Основной цвет текста. */
    val text: String,
)
