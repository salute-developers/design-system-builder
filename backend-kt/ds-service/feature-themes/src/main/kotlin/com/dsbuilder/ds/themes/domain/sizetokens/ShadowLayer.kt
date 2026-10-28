package com.dsbuilder.ds.themes.domain.sizetokens

/** Слой тени в px и цвет: HEX или ссылка на ступень палитры темы. */
data class ShadowLayer(
    /** Смещение по X. */
    val offsetX: Int,
    /** Смещение по Y. */
    val offsetY: Int,
    /** Размытие. */
    val blur: Int,
    /** Растяжение. */
    val spread: Int,
    /**
     * Цвет. В записи и в значениях платформ — `#RRGGBBAA` или ссылка `[type.shade.step][opacity]`; в формате чтения
     * раздела — всегда раскрытый `#RRGGBBAA`.
     */
    val color: String,
    /** Только в формате чтения: исходная ссылка на ступень палитры, если цвет слоя — ссылка. */
    val colorRef: String? = null,
)
