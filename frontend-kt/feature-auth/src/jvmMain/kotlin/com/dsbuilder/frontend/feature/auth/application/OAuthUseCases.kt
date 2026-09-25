package com.dsbuilder.frontend.feature.auth.application

import com.dsbuilder.frontend.core.auth.PkceGenerator
import com.dsbuilder.frontend.core.auth.PkcePair
import com.dsbuilder.frontend.core.auth.TokenExchangeClient
import com.dsbuilder.frontend.core.auth.UserOAuthTokens
import com.dsbuilder.frontend.core.auth.UserSessionCredentialResolver
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runInterruptible
import kotlinx.coroutines.withContext
import java.util.UUID

/**
 * Результат Authorization Code + PKCE логина.
 */
public sealed interface OAuthLoginResult {
    /** Сессия успешно применена. */
    public data object LoggedIn : OAuthLoginResult

    /**
     * Логин завершился ошибкой.
     *
     * @property message user-facing ошибка.
     */
    public data class Failed(public val message: String) : OAuthLoginResult
}

/**
 * Оркестрирует Authorization Code + PKCE flow: PKCE + `state` -> loopback listener -> системный
 * браузер -> ожидание redirect -> обмен кода на токены -> применение сессии.
 *
 * Живёт в `jvmMain`, потому что использует `core-auth`'s `PkceGenerator`, который сам объявлен
 * `jvmMain`-only (единственный сегодняшний потребитель PKCE — JVM-клиенты: `:plugins:android-studio`,
 * будущий `:cli`'s JVM-таргет).
 */
public class OAuthLoginUseCase(
    private val clientId: String,
    private val apiUrlResolver: ApiUrlResolver,
    private val tokenExchangeClient: TokenExchangeClient,
    private val sessionResolver: UserSessionCredentialResolver,
    private val browserLauncher: BrowserLauncher,
    private val redirectListenerFactory: RedirectListenerFactory,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
) {
    /**
     * Запускает вход и возвращает финальный результат. Блокирующее ожидание loopback redirect
     * выполняется на [ioDispatcher], а не на диспетчере вызывающей стороны (например UI-потоке IDE).
     */
    @Suppress("TooGenericExceptionCaught")
    public suspend fun execute(apiUrlOverride: String? = null): OAuthLoginResult = try {
        withContext(ioDispatcher) { performLogin(apiUrlOverride) }
    } catch (exception: CancellationException) {
        throw exception
    } catch (exception: Exception) {
        OAuthLoginResult.Failed(exception.message ?: "Не удалось выполнить вход.")
    }

    private suspend fun performLogin(apiUrlOverride: String?): OAuthLoginResult {
        val gatewayBaseUrl = apiUrlResolver.resolve(apiUrlOverride).value
        val listener = redirectListenerFactory.create()
        val redirectUri = "http://127.0.0.1:${listener.port}/callback"
        val pkce = PkceGenerator.generate()
        val expectedState = UUID.randomUUID().toString()
        val authorizeUrl = AuthorizeUrlBuilder(gatewayBaseUrl, clientId).build(pkce, expectedState, redirectUri)

        // Порт освобождается при любом исходе: ошибка запуска браузера, таймаут, отмена, успех.
        val callback = try {
            browserLauncher.browse(authorizeUrl)
            runInterruptible { listener.awaitCallback() }
        } finally {
            listener.close()
        }

        return when (callback) {
            is LoopbackCallbackResult.Success ->
                handleSuccess(callback, pkce, expectedState, redirectUri)
            is LoopbackCallbackResult.Error ->
                OAuthLoginResult.Failed(callback.errorDescription ?: callback.error)
            LoopbackCallbackResult.Malformed ->
                OAuthLoginResult.Failed("Не удалось получить ответ авторизации.")
        }
    }

    @Suppress("TooGenericExceptionCaught")
    private suspend fun handleSuccess(
        callback: LoopbackCallbackResult.Success,
        pkce: PkcePair,
        expectedState: String,
        redirectUri: String,
    ): OAuthLoginResult {
        if (callback.state != expectedState) {
            return OAuthLoginResult.Failed("Ответ авторизации не прошёл проверку state.")
        }

        return try {
            val tokens = tokenExchangeClient.exchangeAuthorizationCode(
                code = callback.code,
                codeVerifier = pkce.codeVerifier,
                redirectUri = redirectUri,
                clientId = clientId,
            )
            sessionResolver.applyTokens(
                UserOAuthTokens(
                    accessToken = tokens.accessToken,
                    refreshToken = tokens.refreshToken,
                    expiresInSeconds = tokens.expiresInSeconds,
                ),
            )
            OAuthLoginResult.LoggedIn
        } catch (exception: Exception) {
            OAuthLoginResult.Failed(exception.message ?: "Не удалось обменять код на токены.")
        }
    }
}

/**
 * Тихо обновляет пользовательскую OAuth-сессию по сохранённому refresh token. Используется при
 * `401` от бэкенда; при неудаче сбрасывает сессию — вызывающая сторона должна вернуть пользователя
 * на экран логина.
 */
public class RefreshUserSessionUseCase(
    private val tokenExchangeClient: TokenExchangeClient,
    private val sessionResolver: UserSessionCredentialResolver,
    private val clientId: String,
) {
    /** `true`, если сессия успешно обновлена; `false`, если refresh невозможен или не удался. */
    @Suppress("TooGenericExceptionCaught")
    public suspend fun execute(): Boolean {
        val refreshToken = sessionResolver.storedRefreshToken() ?: return false

        return try {
            val tokens = tokenExchangeClient.refresh(refreshToken = refreshToken, clientId = clientId)
            sessionResolver.applyTokens(
                UserOAuthTokens(
                    accessToken = tokens.accessToken,
                    refreshToken = tokens.refreshToken,
                    expiresInSeconds = tokens.expiresInSeconds,
                ),
            )
            true
        } catch (exception: Exception) {
            sessionResolver.clear()
            false
        }
    }
}

/**
 * Заканчивает SSO-сессию в системном браузере и локальную OAuth-сессию.
 *
 * Без похода в браузер очистка была бы "ненастоящей": Keycloak cookie осталась бы жива, и
 * следующий вход молча выдал бы новый code без формы логина. Локальная сессия чистится в любом
 * случае — даже если открыть браузер или дождаться редиректа не удалось.
 */
public class OAuthLogoutUseCase(
    private val clientId: String,
    private val apiUrlResolver: ApiUrlResolver,
    private val sessionResolver: UserSessionCredentialResolver,
    private val browserLauncher: BrowserLauncher,
    private val redirectListenerFactory: RedirectListenerFactory,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
) {
    /** Выполняет логаут. */
    @Suppress("TooGenericExceptionCaught")
    public suspend fun execute(apiUrlOverride: String? = null) {
        withContext(ioDispatcher) {
            try {
                val gatewayBaseUrl = apiUrlResolver.resolve(apiUrlOverride).value
                val listener = redirectListenerFactory.create()
                try {
                    val redirectUri = "http://127.0.0.1:${listener.port}/callback"
                    val logoutUrl = LogoutUrlBuilder(gatewayBaseUrl, clientId).build(redirectUri)
                    browserLauncher.browse(logoutUrl)
                    runInterruptible { listener.awaitCallback() }
                } finally {
                    listener.close()
                }
            } catch (exception: CancellationException) {
                sessionResolver.clear()
                throw exception
            } catch (exception: Exception) {
                // Локальный logout ниже всё равно произойдёт — не блокируем его сетевым отказом.
            }
        }
        sessionResolver.clear()
    }
}
