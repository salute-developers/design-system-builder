package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.EditorStyleReference
import kotlinx.serialization.Serializable

/** Ссылка значения на стиль вложенного компонента. */
@Serializable
data class EditorStyleReferenceResponse(
    /** Идентификатор записи ссылки. */
    val id: String,
    /** Оформление вложенного компонента. */
    val targetAppearanceId: String,
    /** Стили осей вложенного оформления. */
    val styleIds: List<String>,
    /** Текст ссылки. */
    val reference: String,
) {
    companion object {
        /** Преобразует доменную модель. */
        fun from(value: EditorStyleReference) = EditorStyleReferenceResponse(
            value.id.toString(),
            value.targetAppearanceId.toString(),
            value.styleIds.map { it.toString() },
            value.reference,
        )
    }
}
