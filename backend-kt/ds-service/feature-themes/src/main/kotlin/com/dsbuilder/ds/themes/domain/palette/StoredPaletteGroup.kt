package com.dsbuilder.ds.themes.domain.palette

/** Хранимая группа палитры темы. */
data class StoredPaletteGroup(
    /** Идентификатор группы. */
    val id: String,
    /** Вид группы. */
    val kind: PaletteGroupKind,
    /** Ключ системной группы; у пользовательской — `null`. */
    val systemKey: SystemPaletteGroup?,
    /** Подпись группы. */
    val label: String,
)
