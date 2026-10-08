package com.dsbuilder.ds.themes.domain.palette

/** Палитра темы: группы, состав, значения, привязки токенов, копия шаблона и связи. */
data class ThemePalette(
    /** Тема. */
    val tenantId: String,
    /** Ревизия темы. */
    val editRevision: Int,
    /** Пользователь может изменять палитру. */
    val canEdit: Boolean,
    /** Есть правки ступеней или замены источника. */
    val offBrand: Boolean,
    /** Группы в порядке отображения. */
    val groups: List<PaletteGroupView>,
    /** Принадлежность цветовых токенов группам. */
    val tokens: List<PaletteTokenAssignment>,
    /** Копия шаблона темы. */
    val template: List<PaletteTemplateRamp>,
    /** Связи токенов со слотами. */
    val links: List<PaletteLink>,
) {
    /** Растяжка группы по слоту. */
    fun ramp(groupId: String, slot: PaletteRampRef): PaletteRampView? =
        groups.firstOrNull { it.id == groupId }?.ramps?.firstOrNull { it.slot == slot }
}
