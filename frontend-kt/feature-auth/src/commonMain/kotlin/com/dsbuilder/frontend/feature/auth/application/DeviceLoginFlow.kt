package com.dsbuilder.frontend.feature.auth.application

import com.dsbuilder.frontend.core.auth.DeviceAuthorization
import com.dsbuilder.frontend.core.auth.DeviceAuthorizationClient
import com.dsbuilder.frontend.core.auth.TokenExchangeException
import com.dsbuilder.frontend.core.auth.TokenExchangeResult
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlin.time.Duration.Companion.seconds
import kotlin.time.TimeSource

/** Прибавка к интервалу после `slow_down` по RFC 8628. */
private const val SLOW_DOWN_SECONDS = 5L
private const val PENDING = "authorization_pending"
private const val SLOW_DOWN = "slow_down"
private const val EXPIRED = "expired_token"

/**
 * Вход с подтверждением во внешнем браузере (RFC 8628). Отказ OAuth завершает опрос ошибкой, сетевой
 * сбой не прерывает ожидание: пользователь ещё может подтвердить вход.
 */
public class DeviceLoginFlow(
    private val client: DeviceAuthorizationClient,
    private val clientId: String,
    private val scope: String,
    private val timeSource: TimeSource = TimeSource.Monotonic,
) {
    /** Запрашивает код устройства, который пользователь подтвердит в браузере. */
    public suspend fun start(): DeviceAuthorization = client.requestDeviceCode(clientId, scope)

    /** Ждёт подтверждения; отмена корутины прекращает опрос. */
    @Suppress("TooGenericExceptionCaught")
    public suspend fun awaitTokens(device: DeviceAuthorization): TokenExchangeResult {
        val deadline = timeSource.markNow() + device.expiresInSeconds.seconds
        var intervalSeconds = device.intervalSeconds
        while (true) {
            delay(intervalSeconds.seconds)
            if (deadline.hasPassedNow()) throw TokenExchangeException("Device code expired.", EXPIRED)
            try {
                return client.exchangeDeviceCode(clientId, device.deviceCode)
            } catch (exception: CancellationException) {
                throw exception
            } catch (exception: TokenExchangeException) {
                intervalSeconds += extraWaitAfter(exception)
            } catch (exception: Exception) {
                // Сбой сети: следующий опрос ещё может получить токены.
            }
        }
    }

    /** Отказ без кода можно повторить; завершают опрос только окончательные отказы OAuth. */
    private fun extraWaitAfter(exception: TokenExchangeException): Long = when (exception.oauthError) {
        null, PENDING -> 0
        SLOW_DOWN -> SLOW_DOWN_SECONDS
        else -> throw exception
    }
}
