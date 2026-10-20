package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable

/** Ответ удаления токена размеров. */
@Serializable
data class DeleteSizeTokenResponse(
    /** Новая ревизия текущей темы. */
    val editRevision: Int,
    /** Удалённые токены: один или четыре варианта размера тени. */
    val deletedTokenIds: List<String>,
)
