package com.dsbuilder.ds.themes.presentation.colortokens

import kotlinx.serialization.Serializable

/** Член семейства существующего токена с новыми значениями. */
@Serializable
data class ColorTokenMemberValuesById(
    /** Идентификатор определения. */
    val tokenId: String,
    /** Значения для платформ и режимов. */
    val values: List<ColorTokenValueItem>,
)
