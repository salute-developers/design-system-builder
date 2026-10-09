package com.dsbuilder.ds.themes.presentation.palette

import kotlinx.serialization.Serializable

/** Палитра темы. */
@Serializable
data class ThemePaletteResponse(
    /** Тема. */
    val tenantId: String,
    /** Ревизия темы. */
    val editRevision: Int,
    /** Есть ли у участника право `tenants:write`. */
    val canEdit: Boolean,
    /** Есть ли заменённые источники или правки ступеней. */
    val offBrand: Boolean,
    /** Группы. */
    val groups: List<PaletteGroupDto>,
    /** Группы цветовых токенов. */
    val tokens: List<PaletteTokenAssignmentDto>,
    /** Копия шаблона темы. */
    val template: List<PaletteTemplateRampDto>,
)
