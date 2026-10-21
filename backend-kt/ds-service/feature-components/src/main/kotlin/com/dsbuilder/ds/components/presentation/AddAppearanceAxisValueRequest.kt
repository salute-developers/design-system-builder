package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Тело запроса добавления значения оси оформления. */
@Serializable
data class AddAppearanceAxisValueRequest(
    /** Имя значения. */
    val name: String,
    /** Позиция значения; без значения оно добавляется в конец. */
    val position: Int? = null,
)
