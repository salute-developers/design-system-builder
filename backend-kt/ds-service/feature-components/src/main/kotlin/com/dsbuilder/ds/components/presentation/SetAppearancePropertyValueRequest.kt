package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Тело запроса записи значения свойства оформления. */
@Serializable
data class SetAppearancePropertyValueRequest(
    /** Свойство компонента. */
    val propertyId: String,
    /** Стили области: пусто для базы, один для стиля, несколько для сочетания. */
    val styleIds: List<String> = emptyList(),
    /** Имена состояний набора. */
    val states: List<String> = emptyList(),
    /** Тип значения; по умолчанию тип слота либо тип токена. */
    val type: String? = null,
    /** Ссылка на токен. */
    val tokenId: String? = null,
    /** Литеральное значение. */
    val value: String? = null,
    /** Прозрачность в исходной записи. */
    val alpha: String? = null,
    /** Поправка значения. */
    val adjustment: String? = null,
    /** Ссылка на стиль вложенного компонента. */
    val reference: StyleReferenceRequest? = null,
)
