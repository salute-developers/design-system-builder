package com.dsbuilder.ds.themes.domain.palette

/** Принадлежность цветового токена группе палитры. */
data class PaletteTokenAssignment(
    /** Идентификатор токена. */
    val tokenId: String,
    /** Имя токена. */
    val tokenName: String,
    /** Группа токена. */
    val groupId: String,
    /** Привязка явная; иначе — по правилу имени. */
    val explicit: Boolean,
)
