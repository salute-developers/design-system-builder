package com.dsbuilder.frontend.feature.auth.application

import com.dsbuilder.frontend.core.auth.AuthResult
import com.dsbuilder.frontend.core.auth.OAuthCallback
import com.dsbuilder.frontend.core.auth.OAuthCallbackListener
import com.dsbuilder.frontend.core.auth.PkceChallenge
import com.dsbuilder.frontend.core.auth.PkceGenerator
import com.dsbuilder.frontend.core.auth.PkcePlatform
import com.dsbuilder.frontend.core.auth.TokenExchangeClient
import com.dsbuilder.frontend.core.auth.UserOAuthTokens
import com.dsbuilder.frontend.core.auth.UserSessionCredentialResolver
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runInterruptible
import kotlinx.coroutines.withContext

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
 * Адаптирует платформенные порты IDE к общему [PkceLoginFlow] и сохраняет независимую сессию IDE.
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
    /** Запускает общий PKCE-сценарий с отдельным защищённым хранилищем IDE. */
    public suspend fun execute(apiUrlOverride: String? = null): OAuthLoginResult = withContext(ioDispatcher) {
        val platform = IdePkcePlatform(browserLauncher, redirectListenerFactory)
        val apiUrl = try {
            apiUrlResolver.resolve(apiUrlOverride).value
        } catch (exception: IllegalArgumentException) {
            return@withContext OAuthLoginResult.Failed("Некорректный API URL.")
        }
        when (
            val result = PkceLoginFlow(platform).execute(apiUrl, clientId) { code ->
                val tokens = tokenExchangeClient.exchangeAuthorizationCode(
                    code = code.code,
                    codeVerifier = code.verifier,
                    redirectUri = code.redirectUri,
                    clientId = clientId,
                )
                sessionResolver.applyTokens(
                    UserOAuthTokens(tokens.accessToken, tokens.refreshToken, tokens.expiresInSeconds),
                )
                AuthResult.Success(Unit)
            }
        ) {
            is AuthResult.Success -> OAuthLoginResult.LoggedIn
            is AuthResult.Failed -> OAuthLoginResult.Failed(result.message)
        }
    }
}

private class IdePkcePlatform(
    private val browser: BrowserLauncher,
    private val factory: RedirectListenerFactory,
) : PkcePlatform {
    override fun generate(): PkceChallenge {
        val pair = PkceGenerator.generate()
        return PkceChallenge(
            pair.codeVerifier,
            pair.codeChallenge,
            PkceGenerator.generate().codeVerifier,
        )
    }

    override suspend fun listen(): OAuthCallbackListener {
        val delegate = factory.create()
        return object : OAuthCallbackListener {
            override val port: Int get() = delegate.port
            override suspend fun awaitCallback(): OAuthCallback {
                val params = when (val callback = runInterruptible { delegate.awaitCallback(180) }) {
                    is LoopbackCallbackResult.Success -> mapOf(
                        "code" to listOf(callback.code),
                        "state" to listOf(callback.state),
                    )
                    is LoopbackCallbackResult.Error -> mapOf("error" to listOf(callback.error))
                    LoopbackCallbackResult.Malformed -> emptyMap()
                }
                return OAuthCallback("/callback", params)
            }
            override suspend fun complete(success: Boolean) = Unit
            override fun close() = delegate.close()
        }
    }
    override suspend fun openBrowser(url: String) = browser.browse(url)
    override fun currentTimeMillis(): Long = System.currentTimeMillis()
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
        } catch (exception: CancellationException) {
            throw exception
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
