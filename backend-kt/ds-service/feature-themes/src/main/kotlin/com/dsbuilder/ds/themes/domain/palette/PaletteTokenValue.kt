package com.dsbuilder.ds.themes.domain.palette

/** Значение цветового токена темы с разобранной ссылкой на палитру. */
data class PaletteTokenValue(
    /** Идентификатор токена. */
    val tokenId: String,
    /** Режим `light`/`dark` или `null`. */
    val mode: String?,
    /** Платформа. */
    val platform: String,
    /** Ссылка на ступень палитры; `null`, если значение не ссылка. */
    val reference: PaletteReference?,
    /** Идентификатор строки значения, если значение прочитано из базы. */
    val valueId: String? = null,
)
