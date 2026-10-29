package com.dsbuilder.ds.components.domain

/** Итог удаления оси или значения оси с зависимыми данными. */
data class EditorRemoval(
    /** Число удалённых значений свойств, ссылок и сочетаний, зависевших от удалённого. */
    val removedDependents: Int,
)
