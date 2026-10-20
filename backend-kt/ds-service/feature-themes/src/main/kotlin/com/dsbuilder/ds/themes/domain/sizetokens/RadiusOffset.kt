package com.dsbuilder.ds.themes.domain.sizetokens

/** Смещение ссылки компонента на радиус и место, где оно задано. */
data class RadiusOffset(
    /** Смещение в px. */
    val offsetPx: Int,
    /** Компонент, платформа и параметр. */
    val usage: AdjustedUsage,
)
