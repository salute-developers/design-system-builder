package com.dsbuilder.frontend.plugin.androidstudio.auth

import com.dsbuilder.frontend.core.auth.PkceGenerator
import com.dsbuilder.frontend.core.auth.PkcePair
import com.dsbuilder.frontend.core.auth.TokenExchangeClient
import com.dsbuilder.frontend.core.auth.UserOAuthTokens
import com.dsbuilder.frontend.core.auth.UserSessionCredentialResolver
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import java.util.UUID

private const val CLIENT_ID = "dsbuilder-studio-plugin"

/**
 * Оркестрирует Authorization Code + PKCE flow плагина: PKCE + `state` -> loopback listener ->
 * системный браузер -> ожидание redirect -> обмен кода на токены -> применение сессии.
 *
 * Успешный вход переводит состояние обратно в [LoginUiState.Idle] — экран логина не решает сам,
 * что показывать после входа; это делает вызывающая сторона на основании активной сессии.
 */
public class LoginController(
    private val gatewayBaseUrl: String,
    private val tokenExchangeClient: TokenExchangeClient,
    private val sessionResolver: UserSessionCredentialResolver,
    private val browserLauncher: BrowserLauncher,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
    private val listenerFactory: () -> RedirectListener = { LoopbackRedirectListener() },
) {
    private val mutableState = MutableStateFlow<LoginUiState>(LoginUiState.Idle)

    /** Текущее состояние экрана логина. */
    public val state: StateFlow<LoginUiState> = mutableState.asStateFlow()

    /** Запускает вход: переводит [state] в [LoginUiState.Loading], затем в итоговое состояние. */
    public suspend fun login() {
        mutableState.value = LoginUiState.Loading
        mutableState.value = runLoginFlow()
    }

    /**
     * Заканчивает SSO-сессию в системном браузере и локальную сессию плагина. Без похода в
     * браузер очистка была бы "ненастоящей": Keycloak cookie осталась бы жива, и следующий вход
     * молча выдал бы новый code без формы логина. Локальная сессия чистится в любом случае —
     * даже если открыть браузер или дождаться редиректа не удалось.
     */
    @Suppress("TooGenericExceptionCaught")
    public suspend fun logout() {
        withContext(ioDispatcher) {
            try {
                val listener = listenerFactory()
                val redirectUri = "http://127.0.0.1:${listener.port}/callback"
                val logoutUrl = LogoutUrlBuilder(gatewayBaseUrl, CLIENT_ID).build(redirectUri)
                browserLauncher.browse(logoutUrl)
                listener.awaitCallback()
            } catch (exception: Exception) {
                // Локальный logout ниже всё равно произойдёт — не блокируем его сетевым отказом.
            }
        }
        sessionResolver.clear()
        mutableState.value = LoginUiState.Idle
    }

    @Suppress("TooGenericExceptionCaught")
    private suspend fun runLoginFlow(): LoginUiState = try {
        withContext(ioDispatcher) { performLogin() }
    } catch (exception: Exception) {
        LoginUiState.Error(exception.message ?: "Не удалось выполнить вход.")
    }

    private suspend fun performLogin(): LoginUiState {
        val listener = listenerFactory()
        val redirectUri = "http://127.0.0.1:${listener.port}/callback"
        val pkce = PkceGenerator.generate()
        val expectedState = UUID.randomUUID().toString()
        val authorizeUrl = AuthorizeUrlBuilder(gatewayBaseUrl, CLIENT_ID).build(pkce, expectedState, redirectUri)

        browserLauncher.browse(authorizeUrl)

        return when (val callback = listener.awaitCallback()) {
            is LoopbackCallbackResult.Success ->
                handleSuccess(callback, pkce, expectedState, redirectUri)
            is LoopbackCallbackResult.Error ->
                LoginUiState.Error(callback.errorDescription ?: callback.error)
            LoopbackCallbackResult.Malformed ->
                LoginUiState.Error("Не удалось получить ответ авторизации.")
        }
    }

    @Suppress("TooGenericExceptionCaught")
    private suspend fun handleSuccess(
        callback: LoopbackCallbackResult.Success,
        pkce: PkcePair,
        expectedState: String,
        redirectUri: String,
    ): LoginUiState {
        if (callback.state != expectedState) {
            return LoginUiState.Error("Ответ авторизации не прошёл проверку state.")
        }

        return try {
            val tokens = tokenExchangeClient.exchangeAuthorizationCode(
                code = callback.code,
                codeVerifier = pkce.codeVerifier,
                redirectUri = redirectUri,
                clientId = CLIENT_ID,
            )
            sessionResolver.applyTokens(
                UserOAuthTokens(
                    accessToken = tokens.accessToken,
                    refreshToken = tokens.refreshToken,
                    expiresInSeconds = tokens.expiresInSeconds,
                ),
            )
            LoginUiState.Idle
        } catch (exception: Exception) {
            LoginUiState.Error(exception.message ?: "Не удалось обменять код на токены.")
        }
    }
}

/**
 * Тихо обновляет пользовательскую сессию по сохранённому refresh token. Используется при `401`
 * от бэкенда; при неудаче сбрасывает сессию — вызывающая сторона должна вернуть пользователя
 * на экран логина.
 */
public class SessionRefresher(
    private val tokenExchangeClient: TokenExchangeClient,
    private val sessionResolver: UserSessionCredentialResolver,
) {
    /** `true`, если сессия успешно обновлена; `false`, если refresh невозможен или не удался. */
    @Suppress("TooGenericExceptionCaught")
    public suspend fun refresh(): Boolean {
        val refreshToken = sessionResolver.storedRefreshToken() ?: return false

        return try {
            val tokens = tokenExchangeClient.refresh(refreshToken = refreshToken, clientId = CLIENT_ID)
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
