package com.dsbuilder.ds.themes.presentation.colortokens

import kotlinx.serialization.Serializable

/** Итог изменения или удаления цветового токена. */
@Serializable
data class ColorTokenRevisionResponse(
    /** Новая ревизия текущей темы. */
    val editRevision: Int,
    /** Удалённые определения и новые позиции соседей. */
    val structure: ColorTokenStructureResponse? = null,
)
