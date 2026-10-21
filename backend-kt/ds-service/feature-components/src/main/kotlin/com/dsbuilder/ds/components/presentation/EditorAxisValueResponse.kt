package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.EditorAxisValue
import kotlinx.serialization.Serializable

/** Значение оси оформления в модели редактора. */
@Serializable
data class EditorAxisValueResponse(
    /** Идентификатор объявления значения. */
    val id: String,
    /** Идентификатор стиля. */
    val styleId: String,
    /** Действующее имя значения. */
    val name: String,
    /** Отображаемое имя значения, если задано. */
    val displayName: String?,
    /** Позиция значения. */
    val position: Int,
    /** Идентификатор значения конфигурации. */
    val authoredId: String?,
    /** Техническая редакция сущности. */
    val revision: Long?,
) {
    companion object {
        /** Преобразует доменную модель. */
        fun from(value: EditorAxisValue) = EditorAxisValueResponse(
            value.id.toString(),
            value.styleId.toString(),
            value.name,
            value.displayName,
            value.position,
            value.authoredId,
            value.revision,
        )
    }
}
