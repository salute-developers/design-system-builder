package com.dsbuilder.ds.themes.presentation.typography

import kotlinx.serialization.Serializable

/** Базовая редакция значения токена стиля на платформе в теле изменения. */
@Serializable
data class TypographyBaseRevisionDto(
    /** Идентификатор токена стиля. */
    val tokenId: String,
    /** Платформа: `web`, `ios`, `android`. */
    val platform: String,
    /** Техническая редакция значения, с которой клиент начал правку. */
    val baseRevision: Long,
)
