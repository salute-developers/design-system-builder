package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Ссылка значения свойства на стиль вложенного компонента. */
@Serializable
data class StyleReferenceRequest(
    /** Оформление вложенного компонента. */
    val targetAppearanceId: String,
    /** Стили осей вложенного оформления. */
    val styleIds: List<String> = emptyList(),
)
