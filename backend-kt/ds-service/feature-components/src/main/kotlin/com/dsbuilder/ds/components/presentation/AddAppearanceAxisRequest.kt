package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Тело запроса добавления оси оформления. */
@Serializable
data class AddAppearanceAxisRequest(
    /** Имя оси. */
    val name: String,
    /** Имена значений оси в порядке позиций. */
    val values: List<String> = emptyList(),
    /** Позиция оси; без значения ось добавляется в конец. */
    val position: Int? = null,
    /** Имя значения по умолчанию; без значения берётся первое. */
    val defaultValue: String? = null,
)
