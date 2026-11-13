package com.dsbuilder.frontend.plugin.androidstudio.tokens

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
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

internal fun parseTypographyValue(platform: TokenPlatform?, value: JsonElement): TokenValuePayload {
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
