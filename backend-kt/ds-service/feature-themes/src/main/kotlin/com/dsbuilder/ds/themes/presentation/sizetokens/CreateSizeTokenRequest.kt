package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Тело `POST /tenants/{tenantId}/size-tokens`. */
@Serializable
data class CreateSizeTokenRequest(
    /** Раздел: `radius`, `spacing` или `shadow`. */
    val kind: String,
    /** Последний сегмент имени: `xxxl` для `round.xxxl`, размер для тени. */
    val name: String,
    /** Значение радиуса или отступа в px. */
    val valuePx: JsonElement? = null,
    /** Варианты тени `[{ variant, layers, fallbackElevation }]`. */
    val variants: JsonElement? = null,
    /** Слои тени: у создания задаются в [variants], поле принимается для ответа об ошибке. */
    val layers: JsonElement? = null,
)
