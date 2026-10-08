package com.dsbuilder.ds.themes.domain.palette

/** Связь токена со ступенью слота: уникальна по `(tokenId, mode, slot, step)`, платформы собраны. */
data class PaletteLink(
    /** Идентификатор токена. */
    val tokenId: String,
    /** Имя токена. */
    val tokenName: String,
    /** Отображаемое имя токена. */
    val displayName: String?,
    /** Группа токена. */
    val groupId: String,
    /** Режим. */
    val mode: String?,
    /** Слот ссылки. */
    val slot: PaletteRampRef,
    /** Ступень. */
    val step: Int,
    /** Прозрачность ссылки. */
    val opacity: Double?,
    /** Платформы, где значение ссылается на ступень. */
    val platforms: List<String>,
)
