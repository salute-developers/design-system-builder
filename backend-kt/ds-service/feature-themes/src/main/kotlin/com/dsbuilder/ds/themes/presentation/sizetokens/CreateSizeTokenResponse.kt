package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Ответ создания токена размеров. */
@Serializable
data class CreateSizeTokenResponse(
    /** Новая ревизия текущей темы. */
    val editRevision: Int,
    /** Раздел. */
    val kind: String,
    /** Созданные токены в формате чтения: один радиус или отступ, четыре варианта тени. */
    val created: List<JsonElement>,
)
