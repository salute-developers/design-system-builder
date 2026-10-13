package com.dsbuilder.ds.themes.presentation.colortokens

import kotlinx.serialization.Serializable

/** Член семейства цветового токена. */
@Serializable
data class ColorTokenMemberDto(
    /** Идентификатор определения. */
    val tokenId: String,
    /** Полное имя без режима. */
    val name: String,
)
