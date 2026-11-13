package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Тело `POST /tenants/{tenantId}/size-tokens`. */
@Serializable
data class CreateSizeTokenRequest(
    /** Раздел: `radius`, `spacing` или `shadow`. */
    val kind: String,
    /** Последний сегмент имени: `xxxl` для `round.xxxl`; у тени — её имя, например `card`. */
    val name: String,
    /** Значение радиуса или отступа в px. */
    val valuePx: JsonElement? = null,
    /** Слои новой тени с именем [name]. */
    val layers: JsonElement? = null,
    /** Запасная высота новой тени для Android. */
    val fallbackElevation: JsonElement? = null,
)
