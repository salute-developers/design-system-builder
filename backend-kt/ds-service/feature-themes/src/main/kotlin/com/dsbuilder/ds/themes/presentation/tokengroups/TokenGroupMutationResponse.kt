package com.dsbuilder.ds.themes.presentation.tokengroups

import kotlinx.serialization.Serializable

/** Итог создания или изменения узла `{ editRevision, value }`. */
@Serializable
data class TokenGroupMutationResponse(
    /** Новая ревизия текущей темы. */
    val editRevision: Int,
    /** Узел после операции. */
    val value: TokenGroupDto,
)
