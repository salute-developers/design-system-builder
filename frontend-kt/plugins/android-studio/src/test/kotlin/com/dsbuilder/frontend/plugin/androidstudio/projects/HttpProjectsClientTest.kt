package com.dsbuilder.frontend.plugin.androidstudio.projects

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
import io.ktor.http.HttpHeaders
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

class HttpProjectsClientTest {
    @Test
    fun parsesProjectListAndSendsBearerAuthorization() = runBlocking<Unit> {
        var request: HttpRequestData? = null
        val engine = MockEngine {
            request = it
            respond(
                content = """
                    [
                      {"id":"p1","name":"Project One","description":"first"},
                      {"id":"p2","name":"Project Two","description":null}
                    ]
                """.trimIndent(),
            )
        }
        val sessionResolver = UserSessionCredentialResolver(NoOpRefreshTokenStore())
        sessionResolver.applyTokens(UserOAuthTokens("access-a", "refresh-a", 300))

        val apiClient = AuthenticatedApiClient(
            httpClient = HttpClient(engine),
            apiUrl = "https://gateway.example.com",
            sessionResolver = sessionResolver,
            sessionRefresher = SessionRefresher(UnusedTokenExchangeClient(), sessionResolver),
        )

        val projects = HttpProjectsClient(apiClient).listProjects()

        assertEquals(
            listOf(
                Project(id = "p1", name = "Project One", description = "first"),
                Project(id = "p2", name = "Project Two", description = null),
            ),
            projects,
        )
        assertEquals("Bearer access-a", request!!.headers[HttpHeaders.Authorization])
        assertEquals("/api/projects", request!!.url.encodedPath)
    }
}
