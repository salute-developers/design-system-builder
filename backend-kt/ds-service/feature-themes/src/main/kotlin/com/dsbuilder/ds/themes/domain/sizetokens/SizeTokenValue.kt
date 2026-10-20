package com.dsbuilder.ds.themes.domain.sizetokens

/** Новое значение токена: веб и свои значения платформ; платформы без ключа строятся из веба. */
sealed interface SizeTokenValue {
    /** Значение радиуса или отступа в px. */
    data class Dimension(
        /** Значение веба. */
        val valuePx: Int,
        /** Свои значения платформ. */
        val platforms: Map<NativePlatform, Int> = emptyMap(),
    ) : SizeTokenValue

    /** Значение тени: слои веба, запасная высота Android и свои слои платформ. */
    data class Shadow(
        /** Слои веба. */
        val layers: List<ShadowLayer>,
        /** Запасная высота Android: пишется в первый слой, в остальные — `0`. */
        val fallbackElevation: Int,
        /** Свои слои платформ. */
        val platforms: Map<NativePlatform, List<ShadowLayer>> = emptyMap(),
    ) : SizeTokenValue
}
