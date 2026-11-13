package com.dsbuilder.frontend.core.auth

/**
 * Ответ endpoint устройства (RFC 8628).
 *
 * @property deviceCode код для опроса token endpoint.
 * @property userCode код, который пользователь сверяет в браузере.
 * @property verificationUri адрес подтверждения входа.
 * @property intervalSeconds интервал опроса.
 * @property expiresInSeconds срок действия кода.
 */
public data class DeviceAuthorization(
    public val deviceCode: String,
    public val userCode: String,
    public val verificationUri: String,
    public val intervalSeconds: Long,
    public val expiresInSeconds: Long,
)

/**
 * Порт входа для клиентов без локального redirect: подтверждение проходит во внешнем браузере.
 * Реализация — Ktor-based, в `core-network`. Ошибки — [TokenExchangeException].
 */
public interface DeviceAuthorizationClient {
    /** Запрашивает код устройства. */
    public suspend fun requestDeviceCode(clientId: String, scope: String): DeviceAuthorization

    /** Обменивает код устройства на токены; пока вход не подтверждён, отказ содержит `authorization_pending`. */
    public suspend fun exchangeDeviceCode(clientId: String, deviceCode: String): TokenExchangeResult

    /** Завершает сессию на сервере. */
    public suspend fun logout(clientId: String, refreshToken: String)
}
