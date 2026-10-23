package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/**
 * Тело `PUT /tenants/{tenantId}/size-tokens/{tokenId}/value`: `valuePx` у радиуса и отступа, `layers`
 * и `fallbackElevation` у тени. Поля значения принимаются как есть и проверяются по типу токена.
 */
@Serializable
data class UpdateSizeTokenValueRequest(
    /** Значение радиуса или отступа в px. */
    val valuePx: JsonElement? = null,
    /** Слои тени. */
    val layers: JsonElement? = null,
    /** Запасная высота Android. */
    val fallbackElevation: JsonElement? = null,
    /** Свои значения платформ `{ ios, android }`: число у радиуса и отступа, `{ layers }` у тени. */
    val platforms: JsonElement? = null,
    /**
     * Базовые технические редакции значений по платформам `web`, `ios`, `android` из чтения значений темы;
     * приоритетнее заголовка `X-DS-Base-Revision`.
     */
    val baseRevisions: Map<String, Long>? = null,
)
