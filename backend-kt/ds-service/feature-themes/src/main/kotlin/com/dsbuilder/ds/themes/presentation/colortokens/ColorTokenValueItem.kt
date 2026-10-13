package com.dsbuilder.ds.themes.presentation.colortokens

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Значение определения цветового токена для платформы и режима. */
@Serializable
data class ColorTokenValueItem(
    /** Платформа: `web`, `ios` или `android`. */
    val platform: String,
    /** Режим: `light` или `dark`. */
    val mode: String,
    /** Ссылка на запись общей палитры. */
    val paletteId: String? = null,
    /** JSON-значение. */
    val value: JsonElement,
)
