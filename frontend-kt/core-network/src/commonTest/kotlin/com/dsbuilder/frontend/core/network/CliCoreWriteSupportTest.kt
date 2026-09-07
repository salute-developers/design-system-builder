package com.dsbuilder.frontend.core.network

import com.dsbuilder.frontend.core.auth.EnvironmentReader
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.utils.io.readRemaining
import kotlinx.io.readString
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class CliCoreWriteSupportTest {
    @Test
    fun resolveReportsArgumentSource() {
        val resolved = ApiUrlResolver(EnvironmentReader { null }).resolve("http://localhost:8080")

        assertEquals(ApiUrlSource.ARGUMENT, resolved.source)
        assertEquals("--api-url", resolved.sourceName)
        assertTrue(!resolved.isCodeDefault)
    }

    @Test
    fun resolveReportsEnvironmentSource() {
        val reader = EnvironmentReader { name -> "http://env-host".takeIf { name == API_URL_ENV } }

        val resolved = ApiUrlResolver(reader).resolve(null)

        assertEquals(ApiUrlSource.ENVIRONMENT, resolved.source)
        assertEquals(API_URL_ENV, resolved.sourceName)
        assertTrue(!resolved.isCodeDefault)
    }

    @Test
    fun resolveReportsCodeDefaultSource() {
        val resolved = ApiUrlResolver(EnvironmentReader { null }).resolve(null)

        assertEquals(ApiUrlSource.CODE_DEFAULT, resolved.source)
        assertEquals(DEFAULT_API_URL, resolved.value)
        assertTrue(resolved.isCodeDefault)
    }

    @Test
    fun writeResolutionRejectsCodeDefault() {
        val result = ApiUrlResolver(EnvironmentReader { null }).resolveForWrite(null)

        val rejected = assertNotNull(result as? WriteApiUrlResult.Rejected, "умолчание принято для записи")
        assertTrue(rejected.message.contains("--api-url"), rejected.message)
        assertTrue(rejected.message.contains(API_URL_ENV), rejected.message)
    }

    @Test
    fun writeResolutionAcceptsArgument() {
        val result = ApiUrlResolver(EnvironmentReader { null }).resolveForWrite("http://localhost:8080")

        val resolved = assertNotNull(result as? WriteApiUrlResult.Resolved, "явный URL отклонён")
        assertEquals("http://localhost:8080", resolved.url.value)
    }

    @Test
    fun writeResolutionAcceptsEnvironment() {
        val reader = EnvironmentReader { name -> "http://env-host".takeIf { name == API_URL_ENV } }

        val result = ApiUrlResolver(reader).resolveForWrite(null)

        val resolved = assertNotNull(result as? WriteApiUrlResult.Resolved, "env-переменная отклонена")
        assertEquals("http://env-host", resolved.url.value)
    }

    @Test
    fun postSendsJsonBodyWithProjectKeyAuthorization() {
        var captured: HttpRequestData? = null
        var capturedBody = ""
        val client = client { request ->
            captured = request
            capturedBody = request.body.toByteArray().decodeToString()
            respond(content = "{\"ok\":true}", status = HttpStatusCode.OK)
        }

        val result = client.post("/api/projects/p/ds/component-config/import", "{\"dryRun\":true}")

        val request = assertNotNull(captured, "запрос не отправлен")
        assertEquals(HttpMethod.Post, request.method)
        assertEquals("ProjectKey secret-key", request.headers[HttpHeaders.Authorization])
        assertEquals("{\"dryRun\":true}", capturedBody)
        assertEquals("application/json", request.body.contentType?.let { "${it.contentType}/${it.contentSubtype}" })
        assertEquals(AuthenticatedHttpResult.Success("{\"ok\":true}"), result)
    }

    @Test
    fun postJoinsBaseUrlAndPath() {
        var url = ""
        val client = client(apiUrl = "http://localhost:8080/") { request ->
            url = request.url.toString()
            respond(content = "{}", status = HttpStatusCode.OK)
        }

        client.post("/api/projects/p/ds/x", "{}")

        assertEquals("http://localhost:8080/api/projects/p/ds/x", url)
    }

    @Test
    fun postMapsBackendErrorsLikeReads() {
        val cases = mapOf(
            HttpStatusCode.Unauthorized to "unauthorized",
            HttpStatusCode.Forbidden to "forbidden",
            HttpStatusCode.NotFound to "not found",
            HttpStatusCode.InternalServerError to "HTTP 500",
        )

        cases.forEach { (status, expected) ->
            val client = client { respond(content = "", status = status) }

            val result = client.post("/api/projects/p/ds/x", "{}")

            val failure = assertNotNull(result as? AuthenticatedHttpResult.Failure, "статус $status принят как успех")
            assertTrue(failure.message.contains(expected), "статус $status: ${failure.message}")
        }
    }

    @Test
    fun postAndGetShareErrorMapping() {
        val client = client { respond(content = "", status = HttpStatusCode.Forbidden) }

        assertEquals(client.get("/api/x"), client.post("/api/x", "{}"))
    }

    private fun client(
        apiUrl: String = "http://localhost:8080",
        handler: suspend MockEngineHandlerScope.(HttpRequestData) -> io.ktor.client.request.HttpResponseData,
    ): AuthenticatedHttpClient = KtorAuthenticatedHttpClientFactory {
        HttpClient(MockEngine { request -> handler(request) })
    }.create(apiUrl = apiUrl, apiKey = "secret-key")
}

private typealias MockEngineHandlerScope = io.ktor.client.engine.mock.MockRequestHandleScope

private suspend fun io.ktor.http.content.OutgoingContent.toByteArray(): ByteArray = when (this) {
    is io.ktor.http.content.OutgoingContent.ByteArrayContent -> bytes()
    is io.ktor.http.content.OutgoingContent.ReadChannelContent ->
        readFrom().readRemaining().readString().encodeToByteArray()
    else -> ByteArray(0)
}

/**
 * Недоступный backend не должен ронять CLI: движки Ktor бросают собственные типы исключений,
 * и без перехвата пользователь получает стектрейс вместо сообщения.
 */
class UnreachableBackendTest {
    @Test
    fun postReportsTransportFailureInsteadOfThrowing() {
        val client = unreachableClient()

        val result = client.post("/api/projects/p/ds/x", "{}")

        val failure = assertNotNull(result as? AuthenticatedHttpResult.Failure, "получен успех")
        assertTrue(failure.message.contains("unreachable"), failure.message)
        assertTrue(failure.message.lines().size == 1, "сообщение многострочно: ${failure.message}")
        assertTrue(failure.message.length <= 260, "сообщение не ограничено: ${failure.message.length}")
    }

    @Test
    fun getReportsTransportFailureInsteadOfThrowing() {
        val client = unreachableClient()

        val result = client.get("/api/projects/p")

        val failure = assertNotNull(result as? AuthenticatedHttpResult.Failure, "получен успех")
        assertTrue(failure.message.contains("unreachable"), failure.message)
    }

    private fun unreachableClient(): AuthenticatedHttpClient = KtorAuthenticatedHttpClientFactory {
        HttpClient(
            MockEngine {
                throw IllegalStateException("Could not connect to the server.\nline two\nline three")
            },
        )
    }.create(apiUrl = "http://localhost:8080", apiKey = "secret-key")
}
