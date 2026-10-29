package com.dsbuilder.ds.themes.presentation.tokengroups

import kotlinx.serialization.Serializable

/** Итог удаления узла. */
@Serializable
data class TokenGroupRevisionResponse(
    /** Новая ревизия текущей темы. */
    val editRevision: Int,
)
