package com.dsbuilder.ds.themes.domain

import kotlinx.serialization.json.JsonElement
import java.util.UUID

/** Одно platform-specific значение для пакетного сохранения темы. */
data class TenantTokenValueInput(
    /** Идентификатор токена. */
    val tokenId: UUID,
    /** Целевая платформа. */
    val platform: ThemeTokenPlatform,
    /** Режим темы. */
    val mode: ThemeTokenMode?,
    /** Необязательная ссылка на палитру. */
    val paletteId: UUID?,
    /** Явное JSON-значение. */
    val value: JsonElement,
)
