package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Ответ изменения значения токена размеров. */
@Serializable
data class UpdateSizeTokenValueResponse(
    /** Новая ревизия текущей темы. */
    val editRevision: Int,
    /** Токен в формате чтения: [RadiusTokenDto], [SpacingTokenDto] или [ShadowTokenDto]. */
    val token: JsonElement,
    /** Записанные значения платформ. */
    val values: List<WrittenSizeValueDto>,
)
