package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.EditorPropertyValue
import kotlinx.serialization.Serializable

/** Значение свойства оформления в модели редактора. */
@Serializable
data class EditorPropertyValueResponse(
    /** Идентификатор значения. */
    val id: String,
    /** Вид области: `invariant`, `variation` или `combination`. */
    val kind: String,
    /** Идентификатор свойства. */
    val propertyId: String,
    /** Имя свойства. */
    val propertyName: String,
    /** Стили области. */
    val styleIds: List<String>,
    /** Имена состояний набора. */
    val states: List<String>,
    /** Идентификатор набора состояний. */
    val stateSetId: String,
    /** Ссылка на токен. */
    val tokenId: String?,
    /** Литеральное значение. */
    val value: String?,
    /** Прозрачность. */
    val alpha: String?,
    /** Поправка. */
    val adjustment: String?,
    /** Позиция среди значений свойства в области. */
    val position: Int,
    /** Ссылка на стиль вложенного компонента. */
    val reference: EditorStyleReferenceResponse?,
    /** Техническая редакция сущности. */
    val revision: Long?,
    /** Актуальное имя токена. */
    val tokenName: String?,
) {
    companion object {
        /** Преобразует доменную модель. */
        fun from(value: EditorPropertyValue) = EditorPropertyValueResponse(
            value.id.toString(), value.kind.name.lowercase(), value.propertyId.toString(), value.propertyName,
            value.styleIds.map { it.toString() }, value.states, value.stateSetId.toString(), value.tokenId?.toString(),
            value.value, value.alpha, value.adjustment, value.position,
            value.reference?.let(EditorStyleReferenceResponse::from), value.revision, value.tokenName,
        )
    }
}
