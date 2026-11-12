package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Счётчики различий. */
@Serializable
data class IconCountsDto(
    /** Добавлено. */
    val added: Int,
    /** Удалено. */
    val removed: Int,
    /** Изменено. */
    val changed: Int,
    /** Не изменено. */
    val unchanged: Int,
)
