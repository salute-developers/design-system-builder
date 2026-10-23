package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable

/** Радиус в формате чтения раздела. */
@Serializable
data class RadiusTokenDto(
    /** Идентификатор токена. */
    val tokenId: String,
    /** Полное имя, например `round.m`. */
    val name: String,
    /** Значение веба в px; `null` только у полного скругления. */
    val valuePx: Int?,
    /** Полное скругление `round.circle`. */
    val fullRounding: Boolean,
    /** Свои значения платформ `ios` и `android` (`overridden: true`). */
    val platforms: Map<String, Int>,
    /** Текущие числа `ios` и `android` независимо от признака. */
    val native: Map<String, Int?>,
    /** Есть платформа без своего значения, чьё число отличается от веба. */
    val platformsDiffer: Boolean,
    /** Компоненты, которые используют токен. */
    val components: List<ComponentUsageDto>,
    /** Вычисляемые радиусы. */
    val derived: List<DerivedRadiusDto>,
)
