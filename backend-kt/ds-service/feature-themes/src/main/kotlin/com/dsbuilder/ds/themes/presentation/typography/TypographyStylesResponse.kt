package com.dsbuilder.ds.themes.presentation.typography

import kotlinx.serialization.Serializable

/** Ответ `GET /tenants/{tenantId}/typography-styles`. */
@Serializable
data class TypographyStylesResponse(
    /** Текущая ревизия темы. */
    val editRevision: Int,
    /** Может ли пользователь менять стили. */
    val canEdit: Boolean,
    /** Число тем дизайн-системы. */
    val themeCount: Int,
    /** Семейства шрифтов дизайн-системы. */
    val families: List<TypographyFamilyDto>,
    /** Стили по экранам. */
    val screens: List<TypographyScreenDto>,
)
