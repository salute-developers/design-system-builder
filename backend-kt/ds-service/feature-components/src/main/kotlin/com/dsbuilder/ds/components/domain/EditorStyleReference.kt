package com.dsbuilder.ds.components.domain

import java.util.UUID

/** Ссылка значения свойства на стиль вложенного компонента. */
data class EditorStyleReference(
    /** Идентификатор записи ссылки. */
    val id: UUID,
    /** Оформление вложенного компонента. */
    val targetAppearanceId: UUID,
    /** Стили осей вложенного оформления. */
    val styleIds: List<UUID>,
    /** Текст ссылки в исходной записи. */
    val reference: String,
)
