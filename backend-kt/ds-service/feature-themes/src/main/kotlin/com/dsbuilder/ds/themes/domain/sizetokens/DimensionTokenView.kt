package com.dsbuilder.ds.themes.domain.sizetokens

import java.util.UUID

/** Токен радиуса или отступа в px. */
data class DimensionTokenView(
    override val tokenId: UUID,
    override val name: String,
    override val kind: SizeTokenKind,
    /** Значение веба; `null` только у полного скругления. */
    val valuePx: Int?,
    /** Полное скругление `round.circle`. */
    val fullRounding: Boolean,
    /** Свои значения платформ (`overridden: true`). */
    val platforms: Map<NativePlatform, Int>,
    /** Текущие числа платформ независимо от признака. */
    val native: Map<NativePlatform, Int?>,
    /** Есть платформа без своего значения, чьё число отличается от веба. */
    val platformsDiffer: Boolean,
    override val components: List<ComponentUsage>,
    /** Вычисляемые радиусы; у отступа всегда пусто. */
    val derived: List<DerivedRadius>,
) : SizeTokenView
