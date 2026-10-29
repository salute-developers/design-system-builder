package com.dsbuilder.frontend.plugin.androidstudio.tokens

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.floatOrNull
import kotlinx.serialization.json.intOrNull

private const val DEFAULT_FONT_WEIGHT = 400

/** Маппинг ios `weight`-enum в числовую шкалу `FontWeight` — на android она уже числовая. */
private val IOS_FONT_WEIGHTS = mapOf(
    "thin" to 100,
    "ultraLight" to 200,
    "light" to 300,
    "regular" to 400,
    "medium" to 500,
    "semibold" to 600,
    "bold" to 700,
    "heavy" to 800,
    "black" to 900,
)

/**
 * Разбирает значение токена (массив-обёртка, как оно приходит от `/ds/token-values`) в
 * типизированный [TokenValuePayload] для платформ `android`/`ios`. Форма разбора по типу токена
 * зеркалит контракт `TokenValueNormalizer` (`frontend-kt/feature-theme`): `color` — единственная
 * строка, `typography`/`shape`/`spacing` — единственный объект, `gradient`/`shadow` — массив
 * объектов-слоёв. Платформа `web` и любая форма, не совпадающая с ожидаемой, дают
 * [TokenValuePayload.Unsupported] — вызывающий код в этом случае показывает [TokenValue.rawValue].
 * Разбор нигде не бросает исключений — некорректная форма или неизвестное поле молча приводят к
 * [TokenValuePayload.Unsupported].
 */
internal fun parseTokenValuePayload(
    type: TokenType?,
    platform: TokenPlatform?,
    value: JsonElement?,
): TokenValuePayload {
    if (value == null) return TokenValuePayload.Unsupported
    return when (type) {
        TokenType.COLOR -> parseColorValue(value)
        TokenType.SHAPE -> parseShapeValue(platform, value)
        TokenType.SPACING -> parseSpacingValue(platform, value)
        TokenType.GRADIENT -> parseGradientValue(platform, value)
        TokenType.SHADOW -> parseShadowValue(platform, value)
        TokenType.TYPOGRAPHY -> parseTypographyValue(platform, value)
        TokenType.FONT_FAMILY, null -> TokenValuePayload.Unsupported
    }
}

private fun isStructuredPlatform(platform: TokenPlatform?): Boolean =
    platform == TokenPlatform.ANDROID || platform == TokenPlatform.IOS

private fun JsonElement.singleObjectOrNull(): JsonObject? =
    (this as? JsonArray)?.singleOrNull() as? JsonObject

private fun JsonObject.stringOrNull(key: String): String? = (this[key] as? JsonPrimitive)?.contentOrNull

private fun JsonObject.floatOrNull(key: String): Float? = (this[key] as? JsonPrimitive)?.floatOrNull

private fun JsonObject.intOrNull(key: String): Int? = (this[key] as? JsonPrimitive)?.intOrNull

private fun JsonObject.stringListOrNull(key: String): List<String>? {
    return (this[key] as? JsonArray)?.map { (it as? JsonPrimitive)?.contentOrNull ?: return null }
}

private fun JsonObject.floatListOrNull(key: String): List<Float>? {
    return (this[key] as? JsonArray)?.map { (it as? JsonPrimitive)?.floatOrNull ?: return null }
}

private fun parseColorValue(value: JsonElement): TokenValuePayload {
    val hex = ((value as? JsonArray)?.singleOrNull() as? JsonPrimitive)?.contentOrNull
        ?: return TokenValuePayload.Unsupported
    return TokenValuePayload.ColorValue(hex)
}

@Suppress("ReturnCount")
private fun parseShapeValue(platform: TokenPlatform?, value: JsonElement): TokenValuePayload {
    if (!isStructuredPlatform(platform)) return TokenValuePayload.Unsupported
    val obj = value.singleObjectOrNull() ?: return TokenValuePayload.Unsupported
    if (obj.stringOrNull("kind") != "round") return TokenValuePayload.Unsupported
    val cornerRadius = obj.floatOrNull("cornerRadius") ?: return TokenValuePayload.Unsupported
    return TokenValuePayload.ShapeValue(cornerRadius)
}

@Suppress("ReturnCount")
private fun parseSpacingValue(platform: TokenPlatform?, value: JsonElement): TokenValuePayload {
    if (!isStructuredPlatform(platform)) return TokenValuePayload.Unsupported
    val obj = value.singleObjectOrNull() ?: return TokenValuePayload.Unsupported
    val spacing = obj.floatOrNull("value") ?: return TokenValuePayload.Unsupported
    return TokenValuePayload.SpacingValue(spacing)
}

@Suppress("ReturnCount")
private fun parseGradientValue(platform: TokenPlatform?, value: JsonElement): TokenValuePayload {
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
private fun parseShadowValue(platform: TokenPlatform?, value: JsonElement): TokenValuePayload {
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

private fun parseTypographyValue(platform: TokenPlatform?, value: JsonElement): TokenValuePayload {
    val obj = value.singleObjectOrNull() ?: return TokenValuePayload.Unsupported
    val fontFamilyRef = obj.stringOrNull("fontFamilyRef") ?: return TokenValuePayload.Unsupported
    return when (platform) {
        TokenPlatform.ANDROID -> parseAndroidTypography(obj, fontFamilyRef)
        TokenPlatform.IOS -> parseIosTypography(obj, fontFamilyRef)
        else -> TokenValuePayload.Unsupported
    }
}

@Suppress("ReturnCount")
private fun parseAndroidTypography(obj: JsonObject, fontFamilyRef: String): TokenValuePayload {
    return TokenValuePayload.TypographyValue(
        fontFamilyRef = fontFamilyRef,
        fontSizeSp = obj.floatOrNull("textSize") ?: return TokenValuePayload.Unsupported,
        lineHeightSp = obj.floatOrNull("lineHeight") ?: return TokenValuePayload.Unsupported,
        fontWeight = obj.intOrNull("fontWeight") ?: return TokenValuePayload.Unsupported,
        fontStyle = obj.stringOrNull("fontStyle") ?: return TokenValuePayload.Unsupported,
        letterSpacingEm = obj.floatOrNull("letterSpacing") ?: return TokenValuePayload.Unsupported,
    )
}

@Suppress("ReturnCount")
private fun parseIosTypography(obj: JsonObject, fontFamilyRef: String): TokenValuePayload {
    return TokenValuePayload.TypographyValue(
        fontFamilyRef = fontFamilyRef,
        fontSizeSp = obj.floatOrNull("size") ?: return TokenValuePayload.Unsupported,
        lineHeightSp = obj.floatOrNull("lineHeight") ?: return TokenValuePayload.Unsupported,
        // неизвестное значение weight — фолбэк на normal (400), а не Unsupported всей типографики
        fontWeight = IOS_FONT_WEIGHTS[obj.stringOrNull("weight")] ?: DEFAULT_FONT_WEIGHT,
        fontStyle = obj.stringOrNull("style") ?: return TokenValuePayload.Unsupported,
        letterSpacingEm = obj.floatOrNull("kerning") ?: return TokenValuePayload.Unsupported,
    )
}
