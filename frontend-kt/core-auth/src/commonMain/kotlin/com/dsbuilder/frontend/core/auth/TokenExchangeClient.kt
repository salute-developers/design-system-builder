package com.dsbuilder.frontend.core.auth

/**
 * Успешный результат обмена authorization code или refresh token на пару access/refresh token
 * через `/auth/token`.
 *
 * @property accessToken короткоживущий access token для `Authorization: Bearer`.
 * @property refreshToken refresh token для последующего обновления сессии.
 * @property expiresInSeconds время жизни access token в секундах.
 */
public data class TokenExchangeResult(
    public val accessToken: String,
    public val refreshToken: String,
    public val expiresInSeconds: Long,
)

/**
 * Ошибка обмена/обновления токенов. Сообщение не содержит raw secret.
 */
public class TokenExchangeException(
    message: String,
) : RuntimeException(message)

/**
 * Порт обмена OAuth-кодов и refresh token на токены через `/auth/token`. Реализация — Ktor-based,
 * в `core-network`, чтобы `core-auth` не зависел от HTTP client.
 */
public interface TokenExchangeClient {
    /**
     * Обменивает authorization code (Authorization Code + PKCE flow) на пару access/refresh token.
     */
    public suspend fun exchangeAuthorizationCode(
        code: String,
        codeVerifier: String,
        redirectUri: String,
        clientId: String,
    ): TokenExchangeResult

    /**
     * Обновляет сессию по refresh token.
     */
    public suspend fun refresh(
        refreshToken: String,
        clientId: String,
    ): TokenExchangeResult
}
