package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Ответ создания токена размеров; технические редакции — в заголовке `X-DS-Mutation-Metadata`. */
@Serializable
data class CreateSizeTokenResponse(
    /** Раздел. */
    val kind: String,
    /** Созданные токены в формате чтения: один радиус или отступ, четыре варианта тени. */
    val created: List<JsonElement>,
)
