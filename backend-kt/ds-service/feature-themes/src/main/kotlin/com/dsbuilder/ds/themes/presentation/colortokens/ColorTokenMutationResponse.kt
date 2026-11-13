package com.dsbuilder.ds.themes.presentation.colortokens

import kotlinx.serialization.Serializable

/** Итог создания цветового токена `{ editRevision, value }`. */
@Serializable
data class ColorTokenMutationResponse(
    /** Новая ревизия текущей темы. */
    val editRevision: Int,
    /** Созданное семейство. */
    val value: ColorTokenFamilyDto,
    /** Полное подтверждение структуры без повторного чтения справочников. */
    val structure: ColorTokenStructureResponse? = null,
    /** Начальные значения только созданного семейства в текущей теме. */
    val confirmedValues: List<com.dsbuilder.ds.themes.presentation.TenantTokenValueResponse>? = null,
)
