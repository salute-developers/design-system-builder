package com.dsbuilder.ds.themes.presentation.typography

import kotlinx.serialization.Serializable

/** Техническая редакция значения токена темы на платформе. */
@Serializable
data class TypographyValueRevisionDto(
    /** Платформа: `web`, `ios`, `android`. */
    val platform: String,
    /** Устойчивый идентификатор значения. */
    val valueId: String,
    /** Техническая редакция значения; базовая редакция следующего изменения. */
    val revision: Long,
)
