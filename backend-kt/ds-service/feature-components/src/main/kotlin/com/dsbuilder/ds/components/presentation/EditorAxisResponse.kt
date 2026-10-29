package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.EditorAxis
import kotlinx.serialization.Serializable

/** Ось оформления в модели редактора. */
@Serializable
data class EditorAxisResponse(
    /** Идентификатор объявления оси. */
    val id: String,
    /** Идентификатор вариации каталога. */
    val variationId: String,
    /** Действующее имя оси. */
    val name: String,
    /** Отображаемое имя оси, если задано. */
    val displayName: String?,
    /** Позиция оси. */
    val position: Int,
    /** Корневая ли ось. */
    val isRoot: Boolean,
    /** Ось ли цветовой схемы. */
    val isColorScheme: Boolean,
    /** Заблокирована ли ось. */
    val locked: Boolean,
    /** Стиль значения по умолчанию. */
    val defaultStyleId: String?,
    /** Объявленный тип оси. */
    val declaredType: String?,
    /** Техническая редакция сущности. */
    val revision: Long?,
    /** Значения оси. */
    val values: List<EditorAxisValueResponse>,
) {
    companion object {
        /** Преобразует доменную модель. */
        fun from(value: EditorAxis) = EditorAxisResponse(
            value.id.toString(), value.variationId.toString(), value.name, value.displayName, value.position,
            value.isRoot, value.isColorScheme, value.locked, value.defaultStyleId?.toString(), value.declaredType,
            value.revision, value.values.map(EditorAxisValueResponse::from),
        )
    }
}
