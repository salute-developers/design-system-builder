package com.dsbuilder.ds.themes.domain.sizetokens

/** Компонент, платформа и параметр, где у ссылки на радиус задано смещение. */
data class AdjustedUsage(
    /** Имя компонента. */
    val component: String,
    /** Платформа поправки или компонента: `web`, `xml`, `compose`, `ios`. */
    val platform: String,
    /** Платформенный параметр поправки; `null` — смещение задано у строки значения. */
    val parameter: String?,
)
