package com.dsbuilder.frontend.plugin.androidstudio.tokens

import com.dsbuilder.frontend.core.auth.RefreshTokenStore
import com.dsbuilder.frontend.core.auth.TokenExchangeClient
import com.dsbuilder.frontend.core.auth.TokenExchangeResult
import com.dsbuilder.frontend.core.auth.UserOAuthTokens
import com.dsbuilder.frontend.core.auth.UserSessionCredentialResolver
import com.dsbuilder.frontend.plugin.androidstudio.api.AuthenticatedApiClient
import com.dsbuilder.frontend.plugin.androidstudio.auth.SessionRefresher
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals

private class NoOpRefreshTokenStore : RefreshTokenStore {
    override fun save(refreshToken: String) {}

    override fun load(): String? = null

    override fun clear() {}
}

private class UnusedTokenExchangeClient : TokenExchangeClient {
    override suspend fun exchangeAuthorizationCode(
        code: String,
        codeVerifier: String,
        redirectUri: String,
        clientId: String,
    ): TokenExchangeResult = error("not expected to be called")

    override suspend fun refresh(refreshToken: String, clientId: String): TokenExchangeResult =
        error("not expected to be called")
}

private fun clientFor(engine: MockEngine): AuthenticatedApiClient {
    val sessionResolver = UserSessionCredentialResolver(NoOpRefreshTokenStore())
    sessionResolver.applyTokens(UserOAuthTokens("access-a", "refresh-a", 300))
    return AuthenticatedApiClient(
        httpClient = HttpClient(engine),
        apiUrl = "https://gateway.example.com",
        sessionResolver = sessionResolver,
        sessionRefresher = SessionRefresher(UnusedTokenExchangeClient(), sessionResolver),
    )
}

class HttpDesignSystemDataClientTest {
    @Test
    fun parsesTokensAndMapsKnownTypeToEnum() = runBlocking<Unit> {
        var request: HttpRequestData? = null
        val engine = MockEngine {
            request = it
            respond(
                content = """
                    [
                      {"id":"t1","designSystemId":"ds1","name":"surface.default.primary","type":"color","displayName":"Primary"},
                      {"id":"t2","designSystemId":"ds1","name":"unknown.type.token","type":"something_new","displayName":null}
                    ]
                """.trimIndent(),
            )
        }

        val tokens = HttpDesignSystemDataClient(clientFor(engine)).listTokens("project-a")

        assertEquals(
            listOf(
                DesignToken("t1", "ds1", "surface.default.primary", TokenType.COLOR, "Primary"),
                DesignToken("t2", "ds1", "unknown.type.token", null, null),
            ),
            tokens,
        )
        assertEquals("/api/projects/project-a/ds/tokens", request!!.url.encodedPath)
    }

    @Test
    fun parsesTokenValuesUnwrappingSingleElementArray() = runBlocking<Unit> {
        // Реальный backend оборачивает одиночный примитив в массив: ["#FF0000"], а не "#FF0000".
        val engine = MockEngine {
            respond(
                content = """[{"id":"v1","tokenId":"t1","platform":"android","mode":"dark","value":["#FF0000"]}]""",
            )
        }

        val values = HttpDesignSystemDataClient(clientFor(engine)).listTokenValues("project-a")

        assertEquals(1, values.size)
        val value = values.single()
        assertEquals("v1", value.id)
        assertEquals("t1", value.tokenId)
        assertEquals(TokenPlatform.ANDROID, value.platform)
        assertEquals(TokenMode.DARK, value.mode)
        assertEquals("#FF0000", value.rawValue)
    }

    @Test
    fun parsesTokenValuesKeepingMultiElementArrayAsRawJson() = runBlocking<Unit> {
        // Несколько значений (например градиент) — единой схемы нет, показываем как есть.
        val engine = MockEngine {
            respond(
                content = """[{"id":"v1","tokenId":"t1","platform":"web","mode":null,"value":["a","b"]}]""",
            )
        }

        val value = HttpDesignSystemDataClient(clientFor(engine)).listTokenValues("project-a").single()

        assertEquals("[\"a\",\"b\"]", value.rawValue)
    }
}
