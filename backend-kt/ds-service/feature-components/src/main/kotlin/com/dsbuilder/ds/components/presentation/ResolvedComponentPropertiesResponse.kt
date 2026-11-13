package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Итоговые параметры выбранных значений осей конфигурации. */
@Serializable
data class ResolvedComponentPropertiesResponse(
    /** Идентификатор конфигурации. */
    val appearanceId: String,
    /** Выбранные значения осей по ID объявлений. */
    val selectedValueIds: List<String>,
    /** Итоговые значения по свойствам и состояниям. */
    val propertyValues: List<EditorPropertyValueResponse>,
)
