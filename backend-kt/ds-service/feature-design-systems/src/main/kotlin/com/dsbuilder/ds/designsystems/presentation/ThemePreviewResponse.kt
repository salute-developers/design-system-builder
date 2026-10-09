package com.dsbuilder.ds.designsystems.presentation

import com.dsbuilder.ds.designsystems.domain.DesignSystemThemePreview
import kotlinx.serialization.Serializable

/** Preview темы для карточки дизайн-системы. */
@Serializable
data class ThemePreviewResponse(
    /** Идентификатор темы. */
    val tenantId: String,
    /** Отображаемое имя темы. */
    val name: String,
    /** Цвета preview темы. */
    val preview: ThemePreviewColorsResponse,
) {
    companion object {
        /** Преобразует доменное preview темы в HTTP-ответ. */
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
