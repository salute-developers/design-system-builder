package com.dsbuilder.frontend.plugin.androidstudio.auth

import com.dsbuilder.frontend.core.auth.RefreshTokenStore
import com.dsbuilder.frontend.core.auth.TokenExchangeClient
import com.dsbuilder.frontend.core.auth.TokenExchangeException
import com.dsbuilder.frontend.core.auth.TokenExchangeResult
import com.dsbuilder.frontend.core.auth.UserOAuthTokens
import com.dsbuilder.frontend.core.auth.UserSessionCredentialResolver
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * [LoginController] генерирует `state` внутри себя случайно, поэтому фейковый listener не может
 * знать его заранее — [resultProvider] вызывается лениво, уже после того как controller открыл
 * браузер, и может прочитать реальный `state` из перехваченного URL через [FakeBrowserLauncher].
 */
private class FakeRedirectListener(
    override val port: Int = 12345,
    private val resultProvider: () -> LoopbackCallbackResult,
) : RedirectListener {
    override fun awaitCallback(timeoutSeconds: Long): LoopbackCallbackResult = resultProvider()
}

private class FakeBrowserLauncher : BrowserLauncher {
    val browsedUrls = mutableListOf<String>()

    override fun browse(url: String) {
        browsedUrls.add(url)
    }

    fun capturedState(): String = Regex("state=([^&]+)").find(browsedUrls.single())!!.groupValues[1]
}

private class FakeTokenExchangeClient(
    private val result: () -> TokenExchangeResult,
) : TokenExchangeClient {
    var lastCode: String? = null
    var lastCodeVerifier: String? = null
    var lastRedirectUri: String? = null

    override suspend fun exchangeAuthorizationCode(
        code: String,
        codeVerifier: String,
        redirectUri: String,
        clientId: String,
    ): TokenExchangeResult {
        lastCode = code
        lastCodeVerifier = codeVerifier
        lastRedirectUri = redirectUri
        return result()
    }

    override suspend fun refresh(refreshToken: String, clientId: String): TokenExchangeResult = result()
}

private class FakeRefreshTokenStore : RefreshTokenStore {
    private var stored: String? = null

    override fun save(refreshToken: String) {
        stored = refreshToken
    }

    override fun load(): String? = stored

    override fun clear() {
        stored = null
    }
}

class LoginControllerTest {
    @Test
    fun successfulLoginAppliesSessionAndReturnsToIdle() = runBlocking<Unit> {
        val tokenExchangeClient = FakeTokenExchangeClient {
            TokenExchangeResult(accessToken = "access-a", refreshToken = "refresh-a", expiresInSeconds = 300)
        }
        val sessionResolver = UserSessionCredentialResolver(FakeRefreshTokenStore())
        val browserLauncher = FakeBrowserLauncher()
        val controller = LoginController(
            gatewayBaseUrl = "https://gateway.example.com",
            tokenExchangeClient = tokenExchangeClient,
            sessionResolver = sessionResolver,
            browserLauncher = browserLauncher,
            ioDispatcher = Dispatchers.Unconfined,
            listenerFactory = {
                FakeRedirectListener(
                    resultProvider = {
                        LoopbackCallbackResult.Success(code = "code-a", state = browserLauncher.capturedState())
                    },
                )
            },
        )

        controller.login()

        assertEquals(LoginUiState.Idle, controller.state.value)
        assertEquals("access-a", sessionResolver.currentAccessToken())
        assertEquals("refresh-a", sessionResolver.storedRefreshToken())
        assertEquals("code-a", tokenExchangeClient.lastCode)
        assertTrue(
            browserLauncher.browsedUrls.single()
                .startsWith("https://gateway.example.com/realms/dsbuilder/protocol/openid-connect/auth"),
        )
    }

    @Test
    fun stateMismatchIsRejectedWithoutApplyingSession() = runBlocking<Unit> {
        val tokenExchangeClient = FakeTokenExchangeClient {
            TokenExchangeResult(accessToken = "access-a", refreshToken = "refresh-a", expiresInSeconds = 300)
        }
        val sessionResolver = UserSessionCredentialResolver(FakeRefreshTokenStore())
        val controller = LoginController(
            gatewayBaseUrl = "https://gateway.example.com",
            tokenExchangeClient = tokenExchangeClient,
            sessionResolver = sessionResolver,
            browserLauncher = FakeBrowserLauncher(),
            ioDispatcher = Dispatchers.Unconfined,
            listenerFactory = {
                FakeRedirectListener(
                    resultProvider = { LoopbackCallbackResult.Success(code = "code-a", state = "wrong-state") },
                )
            },
        )

        controller.login()

        assertIs<LoginUiState.Error>(controller.state.value)
        assertNull(sessionResolver.currentAccessToken())
        assertNull(tokenExchangeClient.lastCode)
    }

    @Test
    fun oauthErrorFromListenerBecomesErrorState() = runBlocking<Unit> {
        val controller = LoginController(
            gatewayBaseUrl = "https://gateway.example.com",
            tokenExchangeClient = FakeTokenExchangeClient { error("should not be called") },
            sessionResolver = UserSessionCredentialResolver(FakeRefreshTokenStore()),
            browserLauncher = FakeBrowserLauncher(),
            ioDispatcher = Dispatchers.Unconfined,
            listenerFactory = {
                FakeRedirectListener(
                    resultProvider = { LoopbackCallbackResult.Error("access_denied", "User cancelled") },
                )
            },
        )

        controller.login()

        assertEquals(LoginUiState.Error("User cancelled"), controller.state.value)
    }

    @Test
    fun malformedCallbackBecomesErrorState() = runBlocking<Unit> {
        val controller = LoginController(
            gatewayBaseUrl = "https://gateway.example.com",
            tokenExchangeClient = FakeTokenExchangeClient { error("should not be called") },
            sessionResolver = UserSessionCredentialResolver(FakeRefreshTokenStore()),
            browserLauncher = FakeBrowserLauncher(),
            ioDispatcher = Dispatchers.Unconfined,
            listenerFactory = { FakeRedirectListener(resultProvider = { LoopbackCallbackResult.Malformed }) },
        )

        controller.login()

        assertIs<LoginUiState.Error>(controller.state.value)
    }

    @Test
    fun tokenExchangeFailureBecomesErrorState() = runBlocking<Unit> {
        val browserLauncher = FakeBrowserLauncher()
        val controller = LoginController(
            gatewayBaseUrl = "https://gateway.example.com",
            tokenExchangeClient = FakeTokenExchangeClient { throw TokenExchangeException("boom") },
            sessionResolver = UserSessionCredentialResolver(FakeRefreshTokenStore()),
            browserLauncher = browserLauncher,
            ioDispatcher = Dispatchers.Unconfined,
            listenerFactory = {
                FakeRedirectListener(
                    resultProvider = {
                        LoopbackCallbackResult.Success(code = "code-a", state = browserLauncher.capturedState())
                    },
                )
            },
        )

        controller.login()

        assertIs<LoginUiState.Error>(controller.state.value)
    }

    @Test
    fun logoutOpensEndSessionUrlAndClearsLocalSession() = runBlocking<Unit> {
        val sessionResolver = UserSessionCredentialResolver(FakeRefreshTokenStore())
        sessionResolver.applyTokens(
            UserOAuthTokens("access-a", "refresh-a", 300),
        )
        val browserLauncher = FakeBrowserLauncher()
        val controller = LoginController(
            gatewayBaseUrl = "https://gateway.example.com",
            tokenExchangeClient = FakeTokenExchangeClient { error("should not be called") },
            sessionResolver = sessionResolver,
            browserLauncher = browserLauncher,
            ioDispatcher = Dispatchers.Unconfined,
            listenerFactory = { FakeRedirectListener(resultProvider = { LoopbackCallbackResult.Malformed }) },
        )

        controller.logout()

        assertNull(sessionResolver.currentAccessToken())
        assertNull(sessionResolver.storedRefreshToken())
        assertEquals(LoginUiState.Idle, controller.state.value)
        assertTrue(
            browserLauncher.browsedUrls.single()
                .startsWith("https://gateway.example.com/realms/dsbuilder/protocol/openid-connect/logout"),
        )
    }

    @Test
    fun logoutClearsLocalSessionEvenWhenBrowserFails() = runBlocking<Unit> {
        val sessionResolver = UserSessionCredentialResolver(FakeRefreshTokenStore())
        sessionResolver.applyTokens(
            UserOAuthTokens("access-a", "refresh-a", 300),
        )
        val controller = LoginController(
            gatewayBaseUrl = "https://gateway.example.com",
            tokenExchangeClient = FakeTokenExchangeClient { error("should not be called") },
            sessionResolver = sessionResolver,
            browserLauncher = BrowserLauncher { error("no browser available") },
            ioDispatcher = Dispatchers.Unconfined,
            listenerFactory = { FakeRedirectListener(resultProvider = { LoopbackCallbackResult.Malformed }) },
        )

        controller.logout()

        assertNull(sessionResolver.currentAccessToken())
        assertNull(sessionResolver.storedRefreshToken())
    }
}
