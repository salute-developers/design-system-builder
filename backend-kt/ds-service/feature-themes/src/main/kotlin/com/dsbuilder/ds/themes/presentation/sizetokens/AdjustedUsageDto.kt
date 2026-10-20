package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable

/** Компонент, платформа и параметр, где задано смещение вычисляемого радиуса. */
@Serializable
data class AdjustedUsageDto(
    /** Имя компонента. */
    val component: String,
    /** Платформа: `web`, `xml`, `compose` или `ios`. */
    val platform: String,
    /** Платформенный параметр; `null` — смещение задано у строки значения. */
    val parameter: String?,
)
