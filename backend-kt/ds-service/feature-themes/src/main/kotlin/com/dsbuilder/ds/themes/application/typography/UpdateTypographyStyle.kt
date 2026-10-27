package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.typography.TypographyVariant

/** Изменение стиля типографии; `null` — часть не меняется. */
data class UpdateTypographyStyle(
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
    /**
     * Платформа своего значения: `ios` или `android`. С ней размеры и веса пишутся только в эту платформу; без неё —
     * в веб и в платформы, у которых это поле не переопределено.
     */
    val platform: ThemeTokenPlatform? = null,
    /** Базовые редакции значений; значение без элемента сравнивается с базовой редакцией запроса. */
    val baseRevisions: List<TypographyBaseRevision> = emptyList(),
) {
    /** Запрос ничего не меняет. */
    val isEmpty: Boolean
        get() = size == null && lineHeight == null && letterSpacing == null && weights.isEmpty() && fontFamily == null
}
