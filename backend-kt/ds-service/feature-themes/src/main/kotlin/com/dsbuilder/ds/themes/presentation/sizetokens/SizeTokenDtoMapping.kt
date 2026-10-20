package com.dsbuilder.ds.themes.presentation.sizetokens

import com.dsbuilder.ds.themes.application.sizetokens.SizeTokens
import com.dsbuilder.ds.themes.domain.sizetokens.ComponentUsage
import com.dsbuilder.ds.themes.domain.sizetokens.DerivedRadius
import com.dsbuilder.ds.themes.domain.sizetokens.DimensionTokenView
import com.dsbuilder.ds.themes.domain.sizetokens.NativePlatform
import com.dsbuilder.ds.themes.domain.sizetokens.ShadowLayer
import com.dsbuilder.ds.themes.domain.sizetokens.ShadowTokenView
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenKind
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenView
import com.dsbuilder.ds.themes.domain.sizetokens.SizeWrittenValue
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement

/** Ответ чтения раздела. */
internal fun SizeTokens.toResponse() = SizeTokensResponse(
    editRevision = editRevision,
    canEdit = canEdit,
    radii = radii.map(DimensionTokenView::toRadius),
    spacing = spacing.map(DimensionTokenView::toSpacing),
    shadows = shadows.map(ShadowTokenView::toDto),
)

/** Токен в формате чтения своего раздела как JSON. */
internal fun SizeTokenView.toJson(): JsonElement = when (this) {
    is ShadowTokenView -> Json.encodeToJsonElement(ShadowTokenDto.serializer(), toDto())
    is DimensionTokenView -> if (kind == SizeTokenKind.RADIUS) {
        Json.encodeToJsonElement(RadiusTokenDto.serializer(), toRadius())
    } else {
        Json.encodeToJsonElement(SpacingTokenDto.serializer(), toSpacing())
    }
}

/** Записанное значение платформы. */
internal fun SizeWrittenValue.toDto() = WrittenSizeValueDto(platform.wireValue, value, overridden)

private fun DimensionTokenView.toRadius() = RadiusTokenDto(
    tokenId = tokenId.toString(),
    name = name,
    valuePx = valuePx,
    fullRounding = fullRounding,
    platforms = platforms.wire(),
    native = native.wire(),
    platformsDiffer = platformsDiffer,
    components = components.map(ComponentUsage::toDto),
    derived = derived.map(DerivedRadius::toDto),
)

private fun DimensionTokenView.toSpacing() = SpacingTokenDto(
    tokenId = tokenId.toString(),
    name = name,
    valuePx = valuePx,
    platforms = platforms.wire(),
    native = native.wire(),
    platformsDiffer = platformsDiffer,
    components = components.map(ComponentUsage::toDto),
)

private fun ShadowTokenView.toDto() = ShadowTokenDto(
    tokenId = tokenId.toString(),
    name = name,
    layers = layers.map(ShadowLayer::toDto),
    fallbackElevation = fallbackElevation,
    platforms = platforms.wire().mapValues { (_, layers) -> ShadowLayersDto(layers.map(ShadowLayer::toDto)) },
    native = native.wire().mapValues { (_, layers) -> layers?.let { ShadowLayersDto(it.map(ShadowLayer::toDto)) } },
    platformsDiffer = platformsDiffer,
    components = components.map(ComponentUsage::toDto),
)

private fun ShadowLayer.toDto() = ShadowLayerDto(offsetX, offsetY, blur, spread, color)

private fun ComponentUsage.toDto() = ComponentUsageDto(name, count)

private fun DerivedRadius.toDto() = DerivedRadiusDto(
    offsetPx = offsetPx,
    valuePx = valuePx,
    usages = usages.map { AdjustedUsageDto(it.component, it.platform, it.parameter) },
)

private fun <T> Map<NativePlatform, T>.wire(): Map<String, T> =
    NativePlatform.entries.filter { it in this }.associate { it.wireValue to getValue(it) }
