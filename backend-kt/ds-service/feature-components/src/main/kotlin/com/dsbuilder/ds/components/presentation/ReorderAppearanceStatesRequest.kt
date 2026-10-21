package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Тело запроса порядка значений состояний свойства. */
@Serializable
data class ReorderAppearanceStatesRequest(
    /** Свойство компонента. */
    val propertyId: String,
    /** Стили области. */
    val styleIds: List<String> = emptyList(),
    /** Наборы состояний в новом порядке. */
    val states: List<List<String>>,
)
