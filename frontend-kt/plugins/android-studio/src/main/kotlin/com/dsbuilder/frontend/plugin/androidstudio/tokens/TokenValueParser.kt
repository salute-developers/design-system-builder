package com.dsbuilder.frontend.plugin.androidstudio.tokens

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.floatOrNull
import kotlinx.serialization.json.intOrNull

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

internal fun isStructuredPlatform(platform: TokenPlatform?): Boolean =
    platform == TokenPlatform.ANDROID || platform == TokenPlatform.IOS

internal fun JsonElement.singleObjectOrNull(): JsonObject? =
    (this as? JsonArray)?.singleOrNull() as? JsonObject

internal fun JsonObject.stringOrNull(key: String): String? = (this[key] as? JsonPrimitive)?.contentOrNull

internal fun JsonObject.floatOrNull(key: String): Float? = (this[key] as? JsonPrimitive)?.floatOrNull

internal fun JsonObject.intOrNull(key: String): Int? = (this[key] as? JsonPrimitive)?.intOrNull

internal fun JsonObject.stringListOrNull(key: String): List<String>? {
    return (this[key] as? JsonArray)?.map { (it as? JsonPrimitive)?.contentOrNull ?: return null }
}

internal fun JsonObject.floatListOrNull(key: String): List<Float>? {
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
