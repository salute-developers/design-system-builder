package com.dsbuilder.frontend.plugin.androidstudio.tokens

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.floatOrNull

@Suppress("ReturnCount")
internal fun parseGradientValue(platform: TokenPlatform?, value: JsonElement): TokenValuePayload {
    if (!isStructuredPlatform(platform)) return TokenValuePayload.Unsupported
    val array = value as? JsonArray ?: return TokenValuePayload.Unsupported
    val layers = array.mapNotNull { (it as? JsonObject)?.let(::parseGradientLayer) }
    if (layers.isEmpty()) return TokenValuePayload.Unsupported
    return TokenValuePayload.GradientValue(layers)
}

private fun parseGradientLayer(obj: JsonObject): GradientLayer? = when (obj.stringOrNull("kind")) {
    "linear" -> parseLinearGradient(obj)
    "radial" -> parseRadialGradient(obj)
    "angular" -> parseAngularGradient(obj)
    "color" -> parseSolidGradient(obj)
    else -> null
}

@Suppress("ReturnCount")
private fun parseLinearGradient(obj: JsonObject): GradientLayer.Linear? {
    return GradientLayer.Linear(
        colors = obj.stringListOrNull("colors") ?: return null,
        locations = obj.floatListOrNull("locations") ?: return null,
        angle = obj.floatOrNull("angle") ?: return null,
    )
}

@Suppress("ReturnCount")
private fun parseRadialGradient(obj: JsonObject): GradientLayer.Radial? {
    return GradientLayer.Radial(
        colors = obj.stringListOrNull("colors") ?: return null,
        locations = obj.floatListOrNull("locations") ?: return null,
        // android даёт `radius` напрямую; ios — `startRadius`/`endRadius`, сюда попадает `endRadius`
        // (см. design.md — `startRadius` аналога в рендере не имеет)
        radius = obj.floatOrNull("radius") ?: obj.floatOrNull("endRadius") ?: return null,
        centerX = obj.floatOrNull("centerX") ?: return null,
        centerY = obj.floatOrNull("centerY") ?: return null,
    )
}

@Suppress("ReturnCount")
private fun parseAngularGradient(obj: JsonObject): GradientLayer.Angular? {
    return GradientLayer.Angular(
        colors = obj.stringListOrNull("colors") ?: return null,
        locations = obj.floatListOrNull("locations") ?: return null,
        centerX = obj.floatOrNull("centerX") ?: return null,
        centerY = obj.floatOrNull("centerY") ?: return null,
    )
}

private fun parseSolidGradient(obj: JsonObject): GradientLayer.Solid? =
    obj.stringOrNull("background")?.let(GradientLayer::Solid)

@Suppress("ReturnCount")
internal fun parseShadowValue(platform: TokenPlatform?, value: JsonElement): TokenValuePayload {
    if (!isStructuredPlatform(platform)) return TokenValuePayload.Unsupported
    val array = value as? JsonArray ?: return TokenValuePayload.Unsupported
    val layers = array.mapNotNull { (it as? JsonObject)?.let(::parseShadowLayer) }
    if (layers.isEmpty()) return TokenValuePayload.Unsupported
    return TokenValuePayload.ShadowValue(layers)
}

@Suppress("ReturnCount")
private fun parseShadowLayer(obj: JsonObject): ShadowLayerValue? {
    return ShadowLayerValue(
        colorHex = obj.stringOrNull("color") ?: return null,
        offsetX = obj.floatOrNull("offsetX") ?: return null,
        offsetY = obj.floatOrNull("offsetY") ?: return null,
        spreadRadius = obj.floatOrNull("spreadRadius") ?: return null,
        blurRadius = obj.floatOrNull("blurRadius") ?: return null,
        fallbackElevation = obj.floatOrNull("fallbackElevation"),
    )
}
