package com.dsbuilder.ds.themes.domain.palette

/** Цветовой токен дизайн-системы (имя без префикса режима). */
data class PaletteTokenRef(
    /** Идентификатор токена. */
    val id: String,
    /** Имя токена. */
    val name: String,
    /** Отображаемое имя. */
    val displayName: String?,
)
