package com.dsbuilder.frontend.core.network

import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.AuthResult
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.utils.io.readRemaining
import kotlinx.coroutines.test.runTest
import kotlinx.io.readString
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class KtorTokenClientTest {
    @Test
    fun loginPostsPasswordGrantToHardcodedTokenEndpoint() = runTest {
        var request: HttpRequestData? = null
        val client = tokenClient {
            request = it
            respond(TOKEN_RESPONSE)
        }

        val result = client.login("https://api.example.com", "alice", "secret")

        assertIs<AuthResult.Success<com.dsbuilder.frontend.core.auth.TokenResponse>>(result)
        assertEquals("/auth/token", request!!.url.encodedPath)
        assertEquals(HttpMethod.Post, request!!.method)
        val body = request!!.body.toByteArray().decodeToString()
        assertTrue(body.contains("grant_type=password"), body)
        assertTrue(body.contains("client_id=dsbuilder-api"), body)
        assertTrue(body.contains("username=alice"), body)
        assertTrue(body.contains("scope=openid"), body)
    }

    @Test
    fun loginRejectsPlainHttpExceptLoopback() = runTest {
        val client = tokenClient { respond(TOKEN_RESPONSE) }

        val rejected = client.login("http://api.example.com", "alice", "secret")
        val accepted = client.login("http://localhost:8080", "alice", "secret")

        assertEquals(AuthErrorCode.INVALID_AUTH_URL, assertIs<AuthResult.Failed>(rejected).code)
        assertIs<AuthResult.Success<com.dsbuilder.frontend.core.auth.TokenResponse>>(accepted)
    }

    @Test
    fun refreshPostsRefreshGrantToTokenEndpoint() = runTest {
        var request: HttpRequestData? = null
        val client = tokenClient {
            request = it
            respond(TOKEN_RESPONSE)
        }

        val result = client.refresh("https://api.example.com/", "refresh-old")

        assertIs<AuthResult.Success<com.dsbuilder.frontend.core.auth.TokenResponse>>(result)
        assertEquals("/auth/token", request!!.url.encodedPath)
        val body = request!!.body.toByteArray().decodeToString()
        assertTrue(body.contains("grant_type=refresh_token"), body)
        assertTrue(body.contains("refresh_token=refresh-old"), body)
    }

    @Test
    fun refreshMapsInvalidGrantToAuthRequired() = runTest {
        val client = tokenClient {
            respond(
                content = """{"error":"invalid_grant"}""",
                status = HttpStatusCode.BadRequest,
            )
        }

        val result = client.refresh("https://api.example.com/", "refresh-old")

        assertEquals(AuthErrorCode.AUTH_REQUIRED, assertIs<AuthResult.Failed>(result).code)
    }

    @Test
    fun logoutPostsToHardcodedLogoutEndpoint() = runTest {
        var path = ""
        val client = tokenClient {
            path = it.url.encodedPath
            respond("")
        }

        val result = client.logout("https://api.example.com", "refresh-old")

        assertIs<AuthResult.Success<Unit>>(result)
        assertEquals("/auth/logout", path)
    }

    private fun tokenClient(
        handler: suspend TokenMockEngineHandlerScope.(HttpRequestData) -> io.ktor.client.request.HttpResponseData,
    ): KtorTokenClient =
        KtorTokenClient(HttpClient(MockEngine { request -> handler(request) }))

    private companion object {
        const val TOKEN_RESPONSE = """{"access_token":"access","refresh_token":"refresh","expires_in":60}"""
    }
}

private typealias TokenMockEngineHandlerScope = io.ktor.client.engine.mock.MockRequestHandleScope

private suspend fun io.ktor.http.content.OutgoingContent.toByteArray(): ByteArray = when (this) {
    is io.ktor.http.content.OutgoingContent.ByteArrayContent -> bytes()
    is io.ktor.http.content.OutgoingContent.ReadChannelContent ->
        readFrom().readRemaining().readString().encodeToByteArray()
    else -> ByteArray(0)
}
