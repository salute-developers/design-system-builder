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

class KtorDeviceAuthorizationClientTest {
    private val requests = mutableListOf<HttpRequestData>()

    private fun client(body: String, status: HttpStatusCode = HttpStatusCode.OK) = KtorDeviceAuthorizationClient(
        HttpClient(
            MockEngine {
                requests += it
                respond(body, status, headersOf("Content-Type", ContentType.Application.Json.toString()))
            },
        ),
        "https://gateway.example.com",
        "dsbuilder",
    )

    private fun form() = (requests.single().body as FormDataContent).formData

    @Test
    fun requestsDeviceCodeForPluginClient() = runTest {
        val device = client(
            """{"device_code":"device","user_code":"ABCD","verification_uri":"https://kc/device",
                "verification_uri_complete":"https://kc/device?user_code=ABCD","interval":7,"expires_in":300}""",
        ).requestDeviceCode("client", "openid offline_access")

        assertEquals(
            "https://gateway.example.com/realms/dsbuilder/protocol/openid-connect/auth/device",
            requests.single().url.toString(),
        )
        assertEquals("client", form()["client_id"])
        assertEquals("openid offline_access", form()["scope"])
        assertEquals("https://kc/device?user_code=ABCD", device.verificationUri)
        assertEquals(7, device.intervalSeconds)
        assertEquals(300, device.expiresInSeconds)
    }

    @Test
    fun usesRfcDefaultsWhenServerOmitsTimings() = runTest {
        val device = client("""{"device_code":"device","user_code":"ABCD","verification_uri":"https://kc/device"}""")
            .requestDeviceCode("client", "openid")

        assertEquals("https://kc/device", device.verificationUri)
        assertEquals(5, device.intervalSeconds)
        assertEquals(600, device.expiresInSeconds)
    }

    @Test
    fun incompleteDeviceResponseIsNotAnOAuthRefusal() = runTest {
        val failure = assertFailsWith<TokenExchangeException> {
            client("""{"device_code":"device","user_code":"ABCD"}""").requestDeviceCode("client", "openid")
        }

        assertEquals(null, failure.oauthError)
    }

    @Test
    fun exchangeSendsDeviceGrantAndKeepsPendingCode() = runTest {
        val failure = assertFailsWith<TokenExchangeException> {
            client("""{"error":"authorization_pending"}""", HttpStatusCode.BadRequest)
                .exchangeDeviceCode("client", "device")
        }

        assertEquals("authorization_pending", failure.oauthError)
        assertEquals("https://gateway.example.com/auth/token", requests.single().url.toString())
        assertEquals("urn:ietf:params:oauth:grant-type:device_code", form()["grant_type"])
        assertEquals("device", form()["device_code"])
    }

    @Test
    fun logoutSendsRefreshToken() = runTest {
        client("").logout("client", "refresh")

        assertEquals("https://gateway.example.com/auth/logout", requests.single().url.toString())
        assertEquals("refresh", form()["refresh_token"])
    }
}
