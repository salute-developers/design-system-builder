package com.dsbuilder.ds.themes.presentation.typography

import kotlinx.serialization.Serializable

/** Тело `PATCH /tenants/{tenantId}/typography-styles/{tokenId}`. */
@Serializable
data class UpdateTypographyStyleRequest(
    /** Ожидаемая ревизия текущей темы. */
    val editRevision: Int,
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
)
