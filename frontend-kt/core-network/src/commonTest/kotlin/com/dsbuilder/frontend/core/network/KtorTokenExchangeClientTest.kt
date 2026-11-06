package com.dsbuilder.frontend.core.network

import com.dsbuilder.frontend.core.auth.TokenExchangeException
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.client.request.forms.FormDataContent
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class KtorTokenExchangeClientTest {
    @Test
    fun exchangeAuthorizationCodeSendsExpectedFormParameters() = runTest {
        var request: HttpRequestData? = null
        val engine = MockEngine {
            request = it
            respond(
                content = """{"access_token":"access-a","refresh_token":"refresh-a","expires_in":300}""",
                headers = headersOf("Content-Type", ContentType.Application.Json.toString()),
            )
        }
        val client = KtorTokenExchangeClient(HttpClient(engine), "https://gateway.example.com/auth/token")

        val result = client.exchangeAuthorizationCode(
            code = "code-a",
            codeVerifier = "verifier-a",
            redirectUri = "http://127.0.0.1:12345/callback",
            clientId = "dsbuilder-studio-plugin",
        )

        assertEquals("access-a", result.accessToken)
        assertEquals("refresh-a", result.refreshToken)
        assertEquals(300L, result.expiresInSeconds)

        val formData = (request!!.body as FormDataContent).formData
        assertEquals("authorization_code", formData["grant_type"])
        assertEquals("code-a", formData["code"])
        assertEquals("verifier-a", formData["code_verifier"])
        assertEquals("dsbuilder-studio-plugin", formData["client_id"])
    }

    @Test
    fun refreshSendsExpectedFormParameters() = runTest {
        var request: HttpRequestData? = null
        val engine = MockEngine {
            request = it
            respond(
                content = """{"access_token":"access-b","refresh_token":"refresh-b","expires_in":300}""",
                headers = headersOf("Content-Type", ContentType.Application.Json.toString()),
            )
        }
        val client = KtorTokenExchangeClient(HttpClient(engine), "https://gateway.example.com/auth/token")

        val result = client.refresh(refreshToken = "refresh-a", clientId = "dsbuilder-studio-plugin")

        assertEquals("access-b", result.accessToken)
        val formData = (request!!.body as FormDataContent).formData
        assertEquals("refresh_token", formData["grant_type"])
        assertEquals("refresh-a", formData["refresh_token"])
    }

    @Test
    fun ignoresExtraFieldsRealKeycloakResponseContains() = runTest {
        // Настоящий ответ Keycloak несёт больше полей, чем нужно клиенту — без
        // ignoreUnknownKeys разбор падает именно на них, а не на fixture-JSON из других тестов.
        val engine = MockEngine {
            respond(
                content = """
                    {
                      "access_token":"access-a",
                      "expires_in":300,
                      "refresh_expires_in":1800,
                      "refresh_token":"refresh-a",
                      "token_type":"Bearer",
                      "id_token":"id-a",
                      "not-before-policy":0,
                      "session_state":"session-a",
                      "scope":"openid profile email"
                    }
                """.trimIndent(),
                headers = headersOf("Content-Type", ContentType.Application.Json.toString()),
            )
        }
        val client = KtorTokenExchangeClient(HttpClient(engine), "https://gateway.example.com/auth/token")

        val result = client.exchangeAuthorizationCode(
            code = "code-a",
            codeVerifier = "verifier-a",
            redirectUri = "http://127.0.0.1:12345/callback",
            clientId = "dsbuilder-studio-plugin",
        )

        assertEquals("access-a", result.accessToken)
        assertEquals("refresh-a", result.refreshToken)
    }

    @Test
    fun failedExchangeThrowsTokenExchangeException() = runTest {
        val engine = MockEngine { respond(content = "invalid_grant", status = HttpStatusCode.BadRequest) }
        val client = KtorTokenExchangeClient(HttpClient(engine), "https://gateway.example.com/auth/token")

        assertFailsWith<TokenExchangeException> {
            client.exchangeAuthorizationCode(
                code = "code-a",
                codeVerifier = "verifier-a",
                redirectUri = "http://127.0.0.1:12345/callback",
                clientId = "dsbuilder-studio-plugin",
            )
        }
    }
}

class KtorTokenExchangeFailureTest {
    private fun client(status: HttpStatusCode, body: String) = KtorTokenExchangeClient(
        HttpClient(
            MockEngine {
                respond(body, status, headersOf("Content-Type", ContentType.Application.Json.toString()))
            },
        ),
        "https://gateway.example.com/auth/token",
    )

    @Test
    fun refreshKeepsOAuthErrorCode() = runTest {
        val failure = assertFailsWith<TokenExchangeException> {
            client(HttpStatusCode.BadRequest, """{"error":"invalid_grant"}""").refresh("refresh", "client")
        }

        assertEquals("invalid_grant", failure.oauthError)
    }

    @Test
    fun refreshWithoutErrorBodyReportsHttpStatusAsCode() = runTest {
        val failure = assertFailsWith<TokenExchangeException> {
            client(HttpStatusCode.Forbidden, "not json").refresh("refresh", "client")
        }

        assertEquals("http_403", failure.oauthError)
    }

    @Test
    fun serverFailureHasNoOAuthErrorCode() = runTest {
        val failure = assertFailsWith<TokenExchangeException> {
            client(HttpStatusCode.BadGateway, """{"error":"invalid_grant"}""").refresh("refresh", "client")
        }

        assertEquals(null, failure.oauthError)
    }

    @Test
    fun refreshKeepsCurrentRefreshTokenWhenServerReturnsNone() = runTest {
        val result = client(HttpStatusCode.OK, """{"access_token":"access","expires_in":300}""")
            .refresh("current", "client")

        assertEquals("current", result.refreshToken)
    }

    @Test
    fun emptyRefreshTokenDoesNotReplaceCurrentOne() = runTest {
        val result = client(HttpStatusCode.OK, """{"access_token":"access","refresh_token":"","expires_in":300}""")
            .refresh("current", "client")

        assertEquals("current", result.refreshToken)
    }

    @Test
    fun authorizationCodeExchangeRequiresRefreshToken() = runTest {
        assertFailsWith<TokenExchangeException> {
            client(HttpStatusCode.OK, """{"access_token":"access","expires_in":300}""")
                .exchangeAuthorizationCode("code", "verifier", "http://127.0.0.1/callback", "client")
        }
    }
}
