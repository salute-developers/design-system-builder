package com.dsbuilder.ds.components.domain

import java.util.UUID

/** Значение свойства оформления вместе с областью действия и набором состояний. */
data class EditorPropertyValue(
    /** Идентификатор значения. */
    val id: UUID,
    /** Вид области действия. */
    val kind: EditorValueKind,
    /** Идентификатор свойства компонента. */
    val propertyId: UUID,
    /** Имя свойства. */
    val propertyName: String,
    /** Стили области действия: пусто для базы. */
    val styleIds: List<UUID>,
    /** Имена состояний набора. */
    val states: List<String>,
    /** Идентификатор набора состояний. */
    val stateSetId: UUID,
    /** Ссылка на токен; тогда [value] пусто. */
    val tokenId: UUID?,
    /** Литеральное значение. */
    val value: String?,
    /** Прозрачность в исходной записи. */
    val alpha: String?,
    /** Поправка значения. */
    val adjustment: String?,
    /** Позиция среди значений свойства в области. */
    val position: Int,
    /** Ссылка на стиль вложенного компонента. */
    val reference: EditorStyleReference?,
    /** Техническая редакция сущности в черновике. */
    val revision: Long?,
    /** Актуальное имя токена, на который ссылается значение. */
    val tokenName: String? = null,
)
