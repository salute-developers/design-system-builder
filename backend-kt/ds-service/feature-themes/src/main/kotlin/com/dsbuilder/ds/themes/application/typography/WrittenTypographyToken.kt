package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import kotlinx.serialization.json.JsonElement
import java.util.UUID

/** Записанные значения токена стиля. */
data class WrittenTypographyToken(
    /** Идентификатор токена. */
    val tokenId: UUID,
    /** Полное имя токена. */
    val name: String,
    /** Новые значения по платформам. */
    val values: Map<ThemeTokenPlatform, JsonElement>,
)
