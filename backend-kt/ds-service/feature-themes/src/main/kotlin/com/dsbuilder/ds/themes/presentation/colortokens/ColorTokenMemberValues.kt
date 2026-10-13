package com.dsbuilder.ds.themes.presentation.colortokens

import kotlinx.serialization.Serializable

/** Член семейства нового токена со значениями. */
@Serializable
data class ColorTokenMemberValues(
    /** Полное имя без режима, например `text.on-dark.accent-hover`. */
    val name: String,
    /** Значения для платформ и режимов. */
    val values: List<ColorTokenValueItem>,
)
