package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Тело запроса порядка осей оформления. */
@Serializable
data class ReorderAppearanceAxesRequest(
    /** Идентификаторы осей в новом порядке. */
    val axisIds: List<String>,
)
