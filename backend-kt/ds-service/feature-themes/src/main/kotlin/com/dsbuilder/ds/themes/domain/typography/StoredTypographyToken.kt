package com.dsbuilder.ds.themes.domain.typography

import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import kotlinx.serialization.json.JsonElement
import java.util.UUID

/** Токен стиля типографии со значениями текущей темы по платформам. */
data class StoredTypographyToken(
    /** Идентификатор токена. */
    val id: UUID,
    /** Разобранное имя. */
    val name: TypographyTokenName,
    /** Значения текущей темы по платформам. */
    val values: Map<ThemeTokenPlatform, JsonElement>,
)
