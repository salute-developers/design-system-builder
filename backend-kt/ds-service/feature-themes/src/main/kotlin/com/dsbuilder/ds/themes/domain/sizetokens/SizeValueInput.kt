package com.dsbuilder.ds.themes.domain.sizetokens

import kotlinx.serialization.json.JsonElement

/**
 * Значение токена размеров в виде, полученном от клиента: поля проверяются [SizeValueParser] после того, как стал
 * известен тип токена. Отсутствующее поле — `null`.
 */
data class SizeValueInput(
    /** Значение радиуса или отступа в px. */
    val valuePx: JsonElement? = null,
    /** Слои тени. */
    val layers: JsonElement? = null,
    /** Запасная высота Android. */
    val fallbackElevation: JsonElement? = null,
    /** Свои значения платформ `{ ios, android }`. */
    val platforms: JsonElement? = null,
    /** Варианты нового размера тени. */
    val variants: JsonElement? = null,
)
