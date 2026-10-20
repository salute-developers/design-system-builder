package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.ds.themes.domain.typography.TypographyVariant

/** Изменение стиля типографии; `null` — часть не меняется. */
data class UpdateTypographyStyle(
    /** Ожидаемая ревизия текущей темы. */
    val editRevision: Int,
    /** Размер в px на экране токена. */
    val size: Double? = null,
    /** Высота строки в px на экране токена. */
    val lineHeight: Double? = null,
    /** Трекинг в em на экране токена. */
    val letterSpacing: Double? = null,
    /** Веса начертаний на всех экранах. */
    val weights: Map<TypographyVariant, Int> = emptyMap(),
    /** Семейство шрифта на всех экранах: имя токена `fontFamily`. */
    val fontFamily: String? = null,
) {
    /** Запрос ничего не меняет. */
    val isEmpty: Boolean
        get() = size == null && lineHeight == null && letterSpacing == null && weights.isEmpty() && fontFamily == null
}
