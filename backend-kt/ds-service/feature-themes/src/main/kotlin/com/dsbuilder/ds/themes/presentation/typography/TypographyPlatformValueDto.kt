package com.dsbuilder.ds.themes.presentation.typography

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Значение платформы. */
@Serializable
data class TypographyPlatformValueDto(
    /** Платформа: `web`, `ios`, `android`. */
    val platform: String,
    /** Значение в формате платформы. */
    val value: JsonElement,
)
