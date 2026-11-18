package com.dsbuilder.ds.components.domain

/** Запись каталога иконок. */
data class IconEntry(
    /** Каноническое имя, например `DisclosureDownFill`. */
    val name: String,
    /** Ключ значения старого формата без размера, например `disclosure.down.fill`. */
    val legacyKey: String,
    /** Начертание. */
    val style: IconStyle,
    /** Размеры, для которых есть SVG. */
    val sizes: Set<IconSize>,
    /** Категория для фильтра на странице каталога. */
    val category: String?,
    /** Синонимы для поиска, в том числе русские. */
    val aliases: List<String>,
    /** Контрольная сумма содержимого иконки: имя, категория, синонимы, размеры и SVG; пусто до расчёта. */
    val contentHash: String = "",
)
