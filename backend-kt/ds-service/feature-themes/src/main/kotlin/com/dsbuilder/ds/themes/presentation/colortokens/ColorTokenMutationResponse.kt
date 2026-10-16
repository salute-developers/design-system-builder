package com.dsbuilder.ds.themes.presentation.colortokens

import kotlinx.serialization.Serializable

/** Итог создания цветового токена `{ editRevision, value }`. */
@Serializable
data class ColorTokenMutationResponse(
    /** Новая ревизия текущей темы. */
    val editRevision: Int,
    /** Созданное семейство. */
    val value: ColorTokenFamilyDto,
)
