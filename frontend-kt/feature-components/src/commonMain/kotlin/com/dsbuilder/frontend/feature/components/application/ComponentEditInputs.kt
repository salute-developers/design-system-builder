package com.dsbuilder.frontend.feature.components.application

import kotlinx.serialization.Serializable

/** Тело запроса добавления оси оформления. */
@Serializable
public data class AxisCreateInput(
    /** Имя оси. */
    public val name: String,
    /** Имена значений оси в порядке позиций. */
    public val values: List<String> = emptyList(),
    /** Позиция оси
без значения ось добавляется в конец. */
    public val position: Int? = null,
    /** Имя значения по умолчанию
без значения берётся первое. */
    public val defaultValue: String? = null,
)

/** Тело запроса добавления значения оси оформления. */
@Serializable
public data class AxisValueCreateInput(
    /** Имя значения. */
    public val name: String,
    /** Позиция значения
без значения оно добавляется в конец. */
    public val position: Int? = null,
)

/** Тело запроса записи значения свойства оформления. */
@Serializable
public data class PropertySetInput(
    /** Свойство компонента. */
    public val propertyId: String,
    /** Стили области: пусто для базы, один для стиля, несколько для сочетания. */
    public val styleIds: List<String> = emptyList(),
    /** Имена состояний набора. */
    public val states: List<String> = emptyList(),
    /** Тип значения
по умолчанию тип слота либо тип токена. */
    public val type: String? = null,
    /** Ссылка на токен. */
    public val tokenId: String? = null,
    /** Литеральное значение. */
    public val value: String? = null,
    /** Прозрачность в исходной записи. */
    public val alpha: String? = null,
    /** Поправка значения. */
    public val adjustment: String? = null,
    /** Ссылка на стиль вложенного компонента. */
    public val reference: ComponentStyleReference? = null,
)

/** Тело запроса порядка значений состояний свойства. */
@Serializable
public data class StatesOrderInput(
    /** Свойство компонента. */
    public val propertyId: String,
    /** Стили области. */
    public val styleIds: List<String> = emptyList(),
    /** Наборы состояний в новом порядке. */
    public val states: List<List<String>>,
)

/** Ссылка значения свойства на стиль вложенного компонента. */
@Serializable
public data class ComponentStyleReference(
    /** Оформление вложенного компонента. */
    public val targetAppearanceId: String,
    /** Стили осей вложенного оформления. */
    public val styleIds: List<String> = emptyList(),
)
