package com.dsbuilder.frontend.plugin.androidstudio.tokens

import kotlinx.serialization.json.JsonElement

/**
 * Дизайн-система DS Builder, видимая в рамках выбранного проекта.
 *
 * @property id идентификатор дизайн-системы.
 * @property name имя дизайн-системы.
 * @property description описание, если задано.
 */
public data class DesignSystem(
    public val id: String,
    public val name: String,
    public val description: String?,
)

/** Платформа, для которой опубликовано значение токена. */
public enum class TokenPlatform {
    WEB,
    ANDROID,
    IOS,
    ;

    public companion object {
        /** Разбирает значение поля `platform` REST-ответа; неизвестное значение — `null`. */
        public fun fromWireValue(value: String?): TokenPlatform? = when (value) {
            "web" -> WEB
            "android" -> ANDROID
            "ios" -> IOS
            else -> null
        }
    }
}

/** Режим (тема), для которого опубликовано значение токена. */
public enum class TokenMode {
    LIGHT,
    DARK,
    ;

    public companion object {
        /** Разбирает значение поля `mode` REST-ответа; неизвестное значение — `null`. */
        public fun fromWireValue(value: String?): TokenMode? = when (value) {
            "light" -> LIGHT
            "dark" -> DARK
            else -> null
        }
    }
}

/** Тип токена дизайн-системы. */
public enum class TokenType {
    COLOR,
    GRADIENT,
    TYPOGRAPHY,
    FONT_FAMILY,
    SPACING,
    SHAPE,
    SHADOW,
    ;

    public companion object {
        /** Разбирает значение поля `type` REST-ответа; неизвестное значение — `null`. */
        public fun fromWireValue(value: String?): TokenType? = when (value) {
            "color" -> COLOR
            "gradient" -> GRADIENT
            "typography" -> TYPOGRAPHY
            "fontFamily" -> FONT_FAMILY
            "spacing" -> SPACING
            "shape" -> SHAPE
            "shadow" -> SHADOW
            else -> null
        }
    }
}

/**
 * Токен дизайн-системы (без значения — значение приходит отдельно, см. [TokenValue]).
 *
 * @property id идентификатор токена.
 * @property designSystemId дизайн-система, которой принадлежит токен.
 * @property name имя токена.
 * @property type тип токена, если распознан.
 * @property displayName отображаемое имя, если задано.
 */
public data class DesignToken(
    public val id: String,
    public val designSystemId: String?,
    public val name: String,
    public val type: TokenType?,
    public val displayName: String?,
)

/**
 * Значение токена для конкретной платформы/режима.
 *
 * @property id идентификатор значения.
 * @property tokenId токен, которому принадлежит значение.
 * @property tenantId tenant, для которого опубликовано значение, если задан. Дизайн-система может
 *   иметь несколько tenant с независимыми значениями одного токена — без фильтрации по tenant
 *   значение для показа выбиралось бы недетерминированно (см. [GetDesignSystemTokensUseCase]).
 * @property platform платформа, если распознана.
 * @property mode режим (светлая/тёмная тема), если значение зависит от темы; `null` — значение
 *   одно для обеих тем (например spacing).
 * @property rawValue значение как есть, JSON-текстом — используется как фолбэк отображения для
 *   платформы `web` и для форм, которые [parseTokenValuePayload] не распознал (см. [wireValue]).
 * @property wireValue исходный JSON этого значения (массив-обёртка, как пришёл от бэкенда) —
 *   хранится отдельно от [rawValue], потому что типизированный разбор в [TokenValuePayload]
 *   зависит от типа токена ([DesignToken.type]), который в этой точке ещё не известен (`tokens`
 *   и `token-values` — разные REST-вызовы, склеиваются в [TokenWithValue]).
 */
public data class TokenValue(
    public val id: String,
    public val tokenId: String?,
    public val tenantId: String?,
    public val platform: TokenPlatform?,
    public val mode: TokenMode?,
    public val rawValue: String,
    public val wireValue: JsonElement? = null,
)

/**
 * Токен вместе с его значением для выбранной платформы, если оно опубликовано.
 *
 * @property token сам токен.
 * @property value значение для выбранной платформы, или `null`, если не опубликовано.
 */
public data class TokenWithValue(
    public val token: DesignToken,
    public val value: TokenValue?,
) {
    /**
     * Типизированное значение под тип токена — см. [TokenValuePayload]. [TokenValuePayload.Unsupported],
     * если значение не опубликовано, платформа `web`, или форма не совпала с ожидаемой для типа.
     */
    public val payload: TokenValuePayload
        get() = parseTokenValuePayload(token.type, value?.platform, value?.wireValue)
}
