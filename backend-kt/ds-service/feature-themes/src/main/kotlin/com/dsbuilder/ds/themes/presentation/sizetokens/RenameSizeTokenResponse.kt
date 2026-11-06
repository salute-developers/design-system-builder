package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Ответ переименования токена размеров; технические редакции — в заголовке `X-DS-Mutation-Metadata`. */
@Serializable
data class RenameSizeTokenResponse(
    /** Раздел токена: `radius`, `spacing` или `shadow`. */
    val kind: String,
    /** Токен в формате чтения: [RadiusTokenDto], [SpacingTokenDto] или [ShadowTokenDto]. */
    val token: JsonElement,
)
