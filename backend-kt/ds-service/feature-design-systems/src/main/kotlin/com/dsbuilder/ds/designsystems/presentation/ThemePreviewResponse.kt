package com.dsbuilder.ds.designsystems.presentation

import com.dsbuilder.ds.designsystems.domain.DesignSystemThemePreview
import kotlinx.serialization.Serializable

/** Preview темы для карточки дизайн-системы. */
@Serializable
data class ThemePreviewResponse(
    /** Идентификатор темы. */
    val tenantId: String,
    /** Название темы. */
    val name: String,
    /** Цвета превью. */
    val preview: ThemePreviewColorsResponse,
) {
    companion object {
        /** Ответ по превью темы дизайн-системы. */
        fun from(value: DesignSystemThemePreview) = ThemePreviewResponse(
            value.tenantId.toString(),
            value.name,
            ThemePreviewColorsResponse(
                value.accentLight,
                value.onAccentLight,
                value.surfaceLight,
                value.accentDark,
                value.surfaceDark,
            ),
        )
    }
}
