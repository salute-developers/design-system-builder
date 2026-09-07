package com.dsbuilder.frontend.feature.theme.domain

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonPrimitive

/**
 * Нормализует backend `TokenValue.value` по типу token для local SDDS output.
 */
internal class TokenValueNormalizer {
    fun normalize(
        token: Token,
        tokenValue: TokenValue,
    ): TokenValueNormalizationResult =
        when (token.type) {
            COLOR_TYPE -> normalizeSingleString(token, tokenValue)
            TYPOGRAPHY_TYPE, FONT_FAMILY_TYPE -> normalizeSingleObject(token, tokenValue)
            SHAPE_TYPE, SPACING_TYPE -> normalizePlatformScalarOrObject(token, tokenValue)
            GRADIENT_TYPE, SHADOW_TYPE -> normalizeArray(token, tokenValue)
            else -> TokenValueNormalizationResult.Failed(
                "Error: Unsupported token type `${token.type}` for token `${token.name}`.",
            )
        }

    private fun normalizeSingleString(
        token: Token,
        tokenValue: TokenValue,
    ): TokenValueNormalizationResult {
        val onlyValue = tokenValue.value?.singleOrNull()
        val stringValue = onlyValue
            ?.takeIf { it is JsonPrimitive && it.isString }
            ?.jsonPrimitive
            ?.content

        return if (stringValue == null) {
            TokenValueNormalizationResult.Failed(
                "Error: Invalid value shape for `${token.name}`. Token type `color` expects one string value.",
            )
        } else {
            TokenValueNormalizationResult.Success(JsonPrimitive(stringValue))
        }
    }

    private fun normalizeSingleObject(
        token: Token,
        tokenValue: TokenValue,
    ): TokenValueNormalizationResult {
        val objectValue = tokenValue.value?.firstOrNull() as? JsonObject

        return if (objectValue == null) {
            TokenValueNormalizationResult.Failed(
                "Error: Invalid value shape for `${token.name}`. Token type `${token.type}` expects an object value.",
            )
        } else {
            TokenValueNormalizationResult.Success(objectValue)
        }
    }

    private fun normalizePlatformScalarOrObject(
        token: Token,
        tokenValue: TokenValue,
    ): TokenValueNormalizationResult {
        val onlyValue = tokenValue.value?.singleOrNull()
        val objectValue = onlyValue as? JsonObject
        val webStringValue = onlyValue
            ?.takeIf { tokenValue.platform == Platform.WEB && it is JsonPrimitive && it.isString }

        return when {
            objectValue != null -> TokenValueNormalizationResult.Success(objectValue)
            webStringValue != null -> TokenValueNormalizationResult.Success(webStringValue)
            else -> TokenValueNormalizationResult.Failed(
                "Error: Invalid value shape for `${token.name}`. Token type `${token.type}` expects an object value " +
                    "or a web string value.",
            )
        }
    }

    private fun normalizeArray(
        token: Token,
        tokenValue: TokenValue,
    ): TokenValueNormalizationResult =
        tokenValue.value?.let { TokenValueNormalizationResult.Success(JsonArray(it)) }
            ?: TokenValueNormalizationResult.Failed(
                "Error: Invalid value shape for `${token.name}`. Token type `${token.type}` expects an array value.",
            )
}

internal sealed interface TokenValueNormalizationResult {
    data class Success(
        val value: JsonElement,
    ) : TokenValueNormalizationResult

    data class Failed(
        val message: String,
    ) : TokenValueNormalizationResult
}
