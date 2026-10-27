package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import java.util.UUID

/** Базовая техническая редакция значения токена темы на платформе, с которой клиент начал правку. */
data class TypographyBaseRevision(
    /** Токен стиля. */
    val tokenId: UUID,
    /** Платформа значения. */
    val platform: ThemeTokenPlatform,
    /** Техническая редакция из чтения стилей или метаданных предыдущей операции. */
    val baseRevision: Long,
)
