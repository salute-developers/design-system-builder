package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable

/** Вариант тени в формате чтения раздела. */
@Serializable
data class ShadowTokenDto(
    /** Идентификатор токена. */
    val tokenId: String,
    /** Полное имя, например `down.soft.s`. */
    val name: String,
    /** Слои веба. */
    val layers: List<ShadowLayerDto>,
    /** Запасная высота из первого слоя Android, без неё `0`. */
    val fallbackElevation: Int,
    /** Свои слои платформ `ios` и `android` (`overridden: true`). */
    val platforms: Map<String, ShadowLayersDto>,
    /** Текущие слои `ios` и `android` независимо от признака. */
    val native: Map<String, ShadowLayersDto?>,
    /** Есть платформа без своего значения, чьи слои отличаются от веба. */
    val platformsDiffer: Boolean,
    /** Компоненты, которые используют токен. */
    val components: List<ComponentUsageDto>,
)
