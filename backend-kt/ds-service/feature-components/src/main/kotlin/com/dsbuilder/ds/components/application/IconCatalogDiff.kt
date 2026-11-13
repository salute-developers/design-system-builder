package com.dsbuilder.ds.components.application

/** Различия загружаемого и активного каталогов. */
data class IconCatalogDiff(
    /** Число добавленных иконок. */
    val added: Int,
    /** Число удалённых иконок. */
    val removed: Int,
    /** Число изменённых иконок. */
    val changed: Int,
    /** Число неизменных иконок. */
    val unchanged: Int,
    /** Имена добавленных, не более 200. */
    val addedNames: List<String>,
    /** Имена удалённых, не более 200. */
    val removedNames: List<String>,
    /** Имена изменённых, не более 200. */
    val changedNames: List<String>,
    /** Усечён ли хотя бы один список имён. */
    val truncated: Boolean,
)
