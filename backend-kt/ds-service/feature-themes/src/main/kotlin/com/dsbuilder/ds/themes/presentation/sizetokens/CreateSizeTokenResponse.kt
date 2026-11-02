package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Ответ создания токена размеров; технические редакции — в заголовке `X-DS-Mutation-Metadata`. */
@Serializable
data class CreateSizeTokenResponse(
    /** Раздел. */
    val kind: String,
    /** Созданный токен в формате чтения: радиус, отступ или тень. */
    val created: List<JsonElement>,
)
