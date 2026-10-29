package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Тело запроса порядка значений оси оформления. */
@Serializable
data class ReorderAppearanceAxisValuesRequest(
    /** Идентификаторы значений оси в новом порядке. */
    val valueIds: List<String>,
)
