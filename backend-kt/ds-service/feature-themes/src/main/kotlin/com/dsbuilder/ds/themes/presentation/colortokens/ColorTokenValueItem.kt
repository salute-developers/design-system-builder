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
    /** JSON-значение: цвет, web-градиент или слои iOS и Android. */
    val value: JsonElement,
    /** Базовая редакция этой пары платформа/режим. */
    val baseRevision: Long? = null,
    /** Своё значение iOS или Android, а не построенное из web; у web допустимо только `false`. */
    val overridden: Boolean = false,
)
