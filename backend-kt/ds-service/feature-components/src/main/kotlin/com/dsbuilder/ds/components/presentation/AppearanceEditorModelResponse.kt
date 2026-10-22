package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.AppearanceEditorModel
import kotlinx.serialization.Serializable

/** Модель оформления для редактора. */
@Serializable
data class AppearanceEditorModelResponse(
    /** Оформление. */
    val appearance: AppearanceResponse,
    /** Техническая редакция оформления. */
    val revision: Long?,
    /** Оси оформления. */
    val axes: List<EditorAxisResponse>,
    /** Значения свойств оформления. */
    val propertyValues: List<EditorPropertyValueResponse>,
) {
    companion object {
        /** Преобразует доменную модель. */
        fun from(value: AppearanceEditorModel) = AppearanceEditorModelResponse(
            AppearanceResponse.from(value.appearance),
            value.revision,
            value.axes.map(EditorAxisResponse::from),
            value.propertyValues.map(EditorPropertyValueResponse::from),
        )
    }
}
