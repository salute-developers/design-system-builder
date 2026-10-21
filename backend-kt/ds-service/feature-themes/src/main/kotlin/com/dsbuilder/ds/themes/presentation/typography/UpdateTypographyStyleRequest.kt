package com.dsbuilder.ds.themes.presentation.typography

import kotlinx.serialization.Serializable

/** Тело `PATCH /tenants/{tenantId}/typography-styles/{tokenId}`. */
@Serializable
data class UpdateTypographyStyleRequest(
    /** Размер в px. */
    val size: Double? = null,
    /** Высота строки в px. */
    val lineHeight: Double? = null,
    /** Трекинг в em. */
    val letterSpacing: Double? = null,
    /** Веса начертаний: `normal`, `medium`, `bold` → вес. */
    val weights: Map<String, Int>? = null,
    /** Семейство шрифта: имя токена `fontFamily`. */
    val fontFamily: String? = null,
    /** Платформа своего значения: `ios` или `android`; без неё правка относится к вебу. */
    val platform: String? = null,
    /** Базовые редакции значений токенов стиля; приоритетнее заголовка `X-DS-Base-Revision`. */
    val baseRevisions: List<TypographyBaseRevisionDto>? = null,
)
