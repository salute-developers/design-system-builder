package com.dsbuilder.ds.designsystems.domain

import java.util.UUID

/** Краткое представление темы в карточке дизайн-системы. */
data class DesignSystemThemePreview(
    /** Идентификатор темы. */
    val tenantId: UUID,
    /** Название темы. */
    val name: String,
    /** Светлый акцент. */
    val accentLight: String,
    /** Цвет текста поверх светлого акцента. */
    val onAccentLight: String,
    /** Светлая поверхность. */
    val surfaceLight: String,
    /** Тёмный акцент. */
    val accentDark: String,
    /** Тёмная поверхность. */
    val surfaceDark: String,
)
