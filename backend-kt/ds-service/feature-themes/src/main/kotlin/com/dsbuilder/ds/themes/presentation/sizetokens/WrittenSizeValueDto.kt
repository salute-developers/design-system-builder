package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Записанное значение платформы в её формате. */
@Serializable
data class WrittenSizeValueDto(
    /** Платформа: `web`, `ios` или `android`. */
    val platform: String,
    /** Значение в формате платформы. */
    val value: JsonElement,
    /** Своё значение платформы. */
    val overridden: Boolean,
)
