package com.dsbuilder.ds.themes.presentation.palette

import kotlinx.serialization.Serializable

/** Итог операции палитры `{ editRevision, value }`. */
@Serializable
data class PaletteMutationResponse<T>(
    /** Новая ревизия темы. */
    val editRevision: Int,
    /** Значение операции. */
    val value: T,
)
