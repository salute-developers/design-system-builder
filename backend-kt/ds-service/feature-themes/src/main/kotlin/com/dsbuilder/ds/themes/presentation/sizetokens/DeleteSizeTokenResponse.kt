package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable

/** Ответ удаления токена размеров; технические редакции — в заголовке `X-DS-Mutation-Metadata`. */
@Serializable
data class DeleteSizeTokenResponse(
    /** Удалённый токен: радиус, отступ или тень. */
    val deletedTokenIds: List<String>,
)
