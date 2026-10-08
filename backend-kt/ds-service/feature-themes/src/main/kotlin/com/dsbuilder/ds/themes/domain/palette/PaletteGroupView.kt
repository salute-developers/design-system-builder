package com.dsbuilder.ds.themes.domain.palette

/** Группа палитры с составом. */
data class PaletteGroupView(
    /** Идентификатор группы. */
    val id: String,
    /** Вид группы. */
    val kind: PaletteGroupKind,
    /** Ключ системной группы. */
    val systemKey: SystemPaletteGroup?,
    /** Подпись. */
    val label: String,
    /** Растяжки группы. */
    val ramps: List<PaletteRampView>,
)
