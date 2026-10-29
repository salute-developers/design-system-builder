package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable

/** Ответ удаления токена размеров; технические редакции — в заголовке `X-DS-Mutation-Metadata`. */
@Serializable
data class DeleteSizeTokenResponse(
    /** Удалённые токены: один или четыре варианта размера тени. */
    val deletedTokenIds: List<String>,
)
