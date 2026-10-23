package com.dsbuilder.ds.themes.domain.sizetokens

/** Значение одного варианта нового размера тени. */
data class ShadowVariantValue(
    /** Вариант: `down.soft`, `down.hard`, `up.soft` или `up.hard`. */
    val variant: String,
    /** Слои и запасная высота Android. */
    val value: SizeTokenValue.Shadow,
)
