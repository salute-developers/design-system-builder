package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Иконка, удаляемая вместе со ссылками на неё. */
@Serializable
data class RemovedIconInUseDto(
    /** Имя иконки. */
    val name: String,
    /** Удаляемые размеры. */
    val sizes: List<Int>,
    /** Число ссылок. */
    val references: Int,
)
