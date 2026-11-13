package com.dsbuilder.ds.components.application

/** Иконка, удаляемая вместе со ссылками на неё. */
data class RemovedIconInUse(
    /** Имя иконки. */
    val name: String,
    /** Размеры, которые удаляются. */
    val sizes: List<Int>,
    /** Число ссылок. */
    val references: Int,
)
