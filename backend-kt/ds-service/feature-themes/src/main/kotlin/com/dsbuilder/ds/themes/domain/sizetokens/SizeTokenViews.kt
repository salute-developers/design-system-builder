package com.dsbuilder.ds.themes.domain.sizetokens

import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import java.util.UUID

/** Токен размеров в формате чтения из записанных значений платформ, использования компонентами и смещений. */
object SizeTokenViews {
    /**
     * Радиус или отступ: значение веба в px, свои значения платформ по `overridden`, расхождение платформ без признака
     * и вычисляемые радиусы из смещений [offsets]. Если веб не читается, значение берётся у первой читаемой платформы.
     */
    @Suppress("LongParameterList")
    fun dimension(
        tokenId: UUID,
        name: String,
        kind: SizeTokenKind,
        values: Map<ThemeTokenPlatform, SizeStoredValue>,
        components: List<ComponentUsage>,
        offsets: List<RadiusOffset>,
    ): DimensionTokenView {
        val fullRounding = kind == SizeTokenKind.RADIUS && SizeTokenNaming.isFullRounding(name)
        val native = NativePlatform.entries.associateWith {
            SizePlatformValues.readDimension(it.platform, values[it.platform]?.value)
        }
        val web = SizePlatformValues.readDimension(ThemeTokenPlatform.WEB, values[ThemeTokenPlatform.WEB]?.value)
        val valuePx = if (fullRounding) null else web ?: native.values.firstNotNullOfOrNull { it } ?: 0
        val own = NativePlatform.entries.mapNotNull { platform ->
            native[platform]?.takeIf { values[platform.platform]?.overridden == true }?.let { platform to it }
        }.toMap()
        val differ = valuePx != null && NativePlatform.entries.any { platform ->
            platform !in own && native[platform] != null && native[platform] != valuePx
        }
        val derived = if (kind == SizeTokenKind.RADIUS && valuePx != null) derived(valuePx, offsets) else emptyList()
        return DimensionTokenView(
            tokenId = tokenId,
            name = name,
            kind = kind,
            valuePx = valuePx,
            fullRounding = fullRounding,
            platforms = own,
            native = native,
            platformsDiffer = differ,
            components = sorted(components),
            derived = derived,
        )
    }

    /** Вариант тени: слои веба, запасная высота из первого слоя Android, свои слои платформ и расхождение. */
    fun shadow(
        tokenId: UUID,
        name: String,
        values: Map<ThemeTokenPlatform, SizeStoredValue>,
        components: List<ComponentUsage>,
    ): ShadowTokenView {
        val native = NativePlatform.entries.associateWith {
            SizePlatformValues.readShadow(it.platform, values[it.platform]?.value)
        }
        val layers = SizePlatformValues.readShadow(ThemeTokenPlatform.WEB, values[ThemeTokenPlatform.WEB]?.value)
            ?: native.values.firstNotNullOfOrNull { it }
            ?: emptyList()
        val fallbackElevation = SizePlatformValues.readFallbackElevation(values[ThemeTokenPlatform.ANDROID]?.value)
        val own = NativePlatform.entries.mapNotNull { platform ->
            native[platform]?.takeIf { values[platform.platform]?.overridden == true }?.let { platform to it }
        }.toMap()
        val differ = NativePlatform.entries.any { platform ->
            val current = native[platform]
            platform !in own && current != null && !SizePlatformValues.sameLayers(current, layers)
        }
        return ShadowTokenView(tokenId, name, layers, fallbackElevation, own, native, differ, sorted(components))
    }

    /** Вычисляемые радиусы: пары «источник, смещение» без нулевых смещений, значение не меньше 0. */
    fun derived(valuePx: Int, offsets: List<RadiusOffset>): List<DerivedRadius> = offsets
        .filter { it.offsetPx != 0 }
        .groupBy(RadiusOffset::offsetPx)
        .toSortedMap()
        .map { (offset, items) ->
            val usages = items.map(RadiusOffset::usage)
                .distinct()
                .sortedWith(compareBy({ it.component }, { it.platform }, { it.parameter.orEmpty() }))
            DerivedRadius(offset, maxOf(0, valuePx + offset), usages)
        }

    private fun sorted(components: List<ComponentUsage>) = components.sortedBy(ComponentUsage::name)
}
