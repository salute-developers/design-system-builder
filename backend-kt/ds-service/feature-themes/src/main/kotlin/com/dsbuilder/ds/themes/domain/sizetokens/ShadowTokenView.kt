package com.dsbuilder.ds.themes.domain.sizetokens

import java.util.UUID

/** Вариант тени: слои веба, запасная высота Android и свои слои платформ. */
data class ShadowTokenView(
    override val tokenId: UUID,
    override val name: String,
    /** Слои веба. */
    val layers: List<ShadowLayer>,
    /** Запасная высота из первого слоя Android, без неё `0`. */
    val fallbackElevation: Int,
    /** Свои слои платформ (`overridden: true`). */
    val platforms: Map<NativePlatform, List<ShadowLayer>>,
    /** Текущие слои платформ независимо от признака. */
    val native: Map<NativePlatform, List<ShadowLayer>?>,
    /** Есть платформа без своего значения, чьи слои отличаются от веба. */
    val platformsDiffer: Boolean,
    override val components: List<ComponentUsage>,
) : SizeTokenView {
    override val kind: SizeTokenKind
        get() = SizeTokenKind.SHADOW
}
