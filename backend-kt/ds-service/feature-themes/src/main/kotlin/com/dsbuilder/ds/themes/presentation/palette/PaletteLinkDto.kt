package com.dsbuilder.ds.themes.presentation.palette

import kotlinx.serialization.Serializable

/** Связь токена со слотом растяжки. */
@Serializable
data class PaletteLinkDto(
    /** Токен. */
    val tokenId: String,
    /** Имя токена. */
    val tokenName: String,
    /** Отображаемое имя токена. */
    val displayName: String?,
    /** Группа токена. */
    val groupId: String,
    /** Режим. */
    val mode: String?,
    /** Ступень. */
    val step: Int,
    /** Прозрачность ссылки. */
    val opacity: Double?,
    /** Платформы значения. */
    val platforms: List<String>,
)
