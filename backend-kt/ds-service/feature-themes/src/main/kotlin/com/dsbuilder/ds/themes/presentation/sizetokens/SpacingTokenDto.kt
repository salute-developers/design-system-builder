package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable

/** Отступ в формате чтения раздела. */
@Serializable
data class SpacingTokenDto(
    /** Идентификатор токена. */
    val tokenId: String,
    /** Полное имя, например `spacing.4x`. */
    val name: String,
    /** Значение веба в px. */
    val valuePx: Int?,
    /** Свои значения платформ `ios` и `android` (`overridden: true`). */
    val platforms: Map<String, Int>,
    /** Текущие числа `ios` и `android` независимо от признака. */
    val native: Map<String, Int?>,
    /** Есть платформа без своего значения, чьё число отличается от веба. */
    val platformsDiffer: Boolean,
    /** Компоненты, которые используют токен. */
    val components: List<ComponentUsageDto>,
)
