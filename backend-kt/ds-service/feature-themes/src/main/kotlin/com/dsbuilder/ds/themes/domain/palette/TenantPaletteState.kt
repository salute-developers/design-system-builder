package com.dsbuilder.ds.themes.domain.palette

/** Состояние палитры темы — то же, что таблицы `tenant_palette_*`. */
data class TenantPaletteState(
    /** Ревизия темы. */
    val editRevision: Int,
    /** Копия шаблона: растяжка → ступень → `#RRGGBB`. */
    val template: Map<PaletteRampRef, Map<Int, String>>,
    /** Группы: системные и пользовательские. */
    val groups: List<StoredPaletteGroup>,
    /** Хранимые растяжки групп. */
    val ramps: List<StoredPaletteRamp>,
    /** Явные привязки: токен → группа. */
    val tokenGroups: Map<String, String>,
) {
    /** Идентификатор системной группы. */
    fun systemGroupId(key: SystemPaletteGroup): String = groups.first { it.systemKey == key }.id
}
