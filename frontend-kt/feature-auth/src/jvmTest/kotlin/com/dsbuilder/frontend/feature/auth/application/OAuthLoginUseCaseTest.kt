package com.dsbuilder.frontend.feature.auth.application

import com.dsbuilder.frontend.core.auth.RefreshTokenStore
import com.dsbuilder.frontend.core.auth.TokenExchangeClient
import com.dsbuilder.frontend.core.auth.TokenExchangeException
import com.dsbuilder.frontend.core.auth.TokenExchangeResult
import com.dsbuilder.frontend.core.auth.UserOAuthTokens
import com.dsbuilder.frontend.core.auth.UserSessionCredentialResolver
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * [OAuthLoginUseCase] генерирует `state` внутри себя случайно, поэтому фейковый listener не может
 * знать его заранее — [resultProvider] вызывается лениво, уже после того как use case открыл
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

    override suspend fun exchangeAuthorizationCode(
        code: String,
        codeVerifier: String,
        redirectUri: String,
        clientId: String,
    ): TokenExchangeResult {
        lastCode = code
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

private val fixedApiUrlResolver = ApiUrlResolver { null }

private fun useCase(
    tokenExchangeClient: TokenExchangeClient,
    sessionResolver: UserSessionCredentialResolver,
    browserLauncher: BrowserLauncher,
    listenerFactory: RedirectListenerFactory,
): OAuthLoginUseCase = OAuthLoginUseCase(
    clientId = "dsbuilder-studio-plugin",
    apiUrlResolver = fixedApiUrlResolver,
    tokenExchangeClient = tokenExchangeClient,
    sessionResolver = sessionResolver,
    browserLauncher = browserLauncher,
    redirectListenerFactory = listenerFactory,
    ioDispatcher = Dispatchers.Unconfined,
)

class OAuthLoginUseCaseTest {
    @Test
    fun successfulLoginAppliesSession() = runTest {
        val tokenExchangeClient = FakeTokenExchangeClient {
            TokenExchangeResult(accessToken = "access-a", refreshToken = "refresh-a", expiresInSeconds = 300)
        }
        val sessionResolver = UserSessionCredentialResolver(FakeRefreshTokenStore())
        val browserLauncher = FakeBrowserLauncher()

        val result = useCase(
            tokenExchangeClient,
            sessionResolver,
            browserLauncher,
            RedirectListenerFactory {
                FakeRedirectListener(
                    resultProvider = {
                        LoopbackCallbackResult.Success(code = "code-a", state = browserLauncher.capturedState())
                    },
                )
            },
        ).execute()

        assertIs<OAuthLoginResult.LoggedIn>(result)
        assertEquals("access-a", sessionResolver.currentAccessToken())
        assertEquals("refresh-a", sessionResolver.storedRefreshToken())
        assertEquals("code-a", tokenExchangeClient.lastCode)
        assertTrue(
            browserLauncher.browsedUrls.single()
                .startsWith("https://gateway.design-system-builder.ru/realms/dsbuilder/protocol/openid-connect/auth"),
        )
    }

    @Test
    fun stateMismatchIsRejectedWithoutApplyingSession() = runTest {
        val tokenExchangeClient = FakeTokenExchangeClient {
            TokenExchangeResult(accessToken = "access-a", refreshToken = "refresh-a", expiresInSeconds = 300)
        }
        val sessionResolver = UserSessionCredentialResolver(FakeRefreshTokenStore())

        val result = useCase(
            tokenExchangeClient,
            sessionResolver,
            FakeBrowserLauncher(),
            RedirectListenerFactory {
                FakeRedirectListener(
                    resultProvider = { LoopbackCallbackResult.Success(code = "code-a", state = "wrong-state") },
                )
            },
        ).execute()

        assertIs<OAuthLoginResult.Failed>(result)
        assertNull(sessionResolver.currentAccessToken())
        assertNull(tokenExchangeClient.lastCode)
    }

    @Test
    fun oauthErrorFromListenerBecomesFailedResult() = runTest {
        val result = useCase(
            FakeTokenExchangeClient { error("should not be called") },
            UserSessionCredentialResolver(FakeRefreshTokenStore()),
            FakeBrowserLauncher(),
            RedirectListenerFactory {
                FakeRedirectListener(
                    resultProvider = { LoopbackCallbackResult.Error("access_denied", "User cancelled") },
                )
            },
        ).execute()

        assertEquals(OAuthLoginResult.Failed("User cancelled"), result)
    }

    @Test
    fun malformedCallbackBecomesFailedResult() = runTest {
        val result = useCase(
            FakeTokenExchangeClient { error("should not be called") },
            UserSessionCredentialResolver(FakeRefreshTokenStore()),
            FakeBrowserLauncher(),
            RedirectListenerFactory { FakeRedirectListener(resultProvider = { LoopbackCallbackResult.Malformed }) },
        ).execute()

        assertIs<OAuthLoginResult.Failed>(result)
    }

    @Test
    fun tokenExchangeFailureBecomesFailedResult() = runTest {
        val browserLauncher = FakeBrowserLauncher()

        val result = useCase(
            FakeTokenExchangeClient { throw TokenExchangeException("boom") },
            UserSessionCredentialResolver(FakeRefreshTokenStore()),
            browserLauncher,
            RedirectListenerFactory {
                FakeRedirectListener(
                    resultProvider = {
                        LoopbackCallbackResult.Success(code = "code-a", state = browserLauncher.capturedState())
                    },
                )
            },
        ).execute()

        assertIs<OAuthLoginResult.Failed>(result)
    }
}

class OAuthLogoutUseCaseTest {
    @Test
    fun logoutOpensEndSessionUrlAndClearsLocalSession() = runTest {
        val sessionResolver = UserSessionCredentialResolver(FakeRefreshTokenStore())
        sessionResolver.applyTokens(UserOAuthTokens("access-a", "refresh-a", 300))
        val browserLauncher = FakeBrowserLauncher()

        OAuthLogoutUseCase(
            clientId = "dsbuilder-studio-plugin",
            apiUrlResolver = fixedApiUrlResolver,
            sessionResolver = sessionResolver,
            browserLauncher = browserLauncher,
            redirectListenerFactory = RedirectListenerFactory {
                FakeRedirectListener(resultProvider = { LoopbackCallbackResult.Malformed })
            },
            ioDispatcher = Dispatchers.Unconfined,
        ).execute()

        assertNull(sessionResolver.currentAccessToken())
        assertNull(sessionResolver.storedRefreshToken())
        assertTrue(
            browserLauncher.browsedUrls.single().startsWith(
                "https://gateway.design-system-builder.ru/realms/dsbuilder/protocol/openid-connect/logout",
            ),
        )
    }

    @Test
    fun logoutClearsLocalSessionEvenWhenBrowserFails() = runTest {
        val sessionResolver = UserSessionCredentialResolver(FakeRefreshTokenStore())
        sessionResolver.applyTokens(UserOAuthTokens("access-a", "refresh-a", 300))

        OAuthLogoutUseCase(
            clientId = "dsbuilder-studio-plugin",
            apiUrlResolver = fixedApiUrlResolver,
            sessionResolver = sessionResolver,
            browserLauncher = BrowserLauncher { error("no browser available") },
            redirectListenerFactory = RedirectListenerFactory {
                FakeRedirectListener(resultProvider = { LoopbackCallbackResult.Malformed })
            },
            ioDispatcher = Dispatchers.Unconfined,
        ).execute()

        assertNull(sessionResolver.currentAccessToken())
        assertNull(sessionResolver.storedRefreshToken())
    }
}

class RefreshUserSessionUseCaseTest {
    @Test
    fun successfulRefreshAppliesNewTokens() = runTest {
        val sessionResolver = UserSessionCredentialResolver(FakeRefreshTokenStore())
        sessionResolver.applyTokens(UserOAuthTokens("access-old", "refresh-old", 300))
        val useCase = RefreshUserSessionUseCase(
            tokenExchangeClient = FakeTokenExchangeClient {
                TokenExchangeResult(accessToken = "access-new", refreshToken = "refresh-new", expiresInSeconds = 300)
            },
            sessionResolver = sessionResolver,
            clientId = "dsbuilder-studio-plugin",
        )

        val refreshed = useCase.execute()

        assertTrue(refreshed)
        assertEquals("access-new", sessionResolver.currentAccessToken())
        assertEquals("refresh-new", sessionResolver.storedRefreshToken())
    }

    @Test
    fun failedRefreshClearsSession() = runTest {
        val sessionResolver = UserSessionCredentialResolver(FakeRefreshTokenStore())
        sessionResolver.applyTokens(UserOAuthTokens("access-old", "refresh-old", 300))
        val useCase = RefreshUserSessionUseCase(
            tokenExchangeClient = FakeTokenExchangeClient { throw TokenExchangeException("expired") },
            sessionResolver = sessionResolver,
            clientId = "dsbuilder-studio-plugin",
        )

        val refreshed = useCase.execute()

        assertTrue(!refreshed)
        assertNull(sessionResolver.currentAccessToken())
        assertNull(sessionResolver.storedRefreshToken())
    }

    @Test
    fun noStoredRefreshTokenFailsWithoutCallingClient() = runTest {
        val useCase = RefreshUserSessionUseCase(
            tokenExchangeClient = FakeTokenExchangeClient { error("should not be called") },
            sessionResolver = UserSessionCredentialResolver(FakeRefreshTokenStore()),
            clientId = "dsbuilder-studio-plugin",
        )

        assertTrue(!useCase.execute())
    }
}
