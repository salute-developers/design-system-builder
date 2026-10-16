package com.dsbuilder.ds.themes.presentation.palette

import kotlinx.serialization.Serializable

/** Группа цветового токена. */
@Serializable
data class PaletteTokenAssignmentDto(
    /** Токен. */
    val tokenId: String,
    /** Имя токена. */
    val tokenName: String,
    /** Группа. */
    val groupId: String,
    /** `explicit` или `default`. */
    val assignment: String,
)
