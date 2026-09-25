package com.dsbuilder.frontend.feature.auth.data

import com.dsbuilder.frontend.feature.auth.application.LoopbackCallbackResult
import java.net.ConnectException
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs

private val httpClient: HttpClient = HttpClient.newHttpClient()

private fun get(url: String): HttpResponse<String> {
    val request = HttpRequest.newBuilder(URI.create(url)).GET().build()
    return httpClient.send(request, HttpResponse.BodyHandlers.ofString())
}

class JvmLoopbackRedirectListenerTest {
    @Test
    fun successfulRedirectIsParsedAndServerRespondsWithHtml() {
        val listener = JvmLoopbackRedirectListener()

        val response = get("http://127.0.0.1:${listener.port}/callback?code=code-a&state=state-a")
        val result = listener.awaitCallback(timeoutSeconds = 5)

        assertEquals(200, response.statusCode())
        assertEquals(LoopbackCallbackResult.Success(code = "code-a", state = "state-a"), result)
    }

    @Test
    fun oauthErrorRedirectIsParsed() {
        val listener = JvmLoopbackRedirectListener()

        get("http://127.0.0.1:${listener.port}/callback?error=access_denied&error_description=User+cancelled")
        val result = listener.awaitCallback(timeoutSeconds = 5)

        assertEquals(LoopbackCallbackResult.Error(error = "access_denied", errorDescription = "User cancelled"), result)
    }

    @Test
    fun redirectWithoutCodeOrErrorIsMalformed() {
        val listener = JvmLoopbackRedirectListener()

        get("http://127.0.0.1:${listener.port}/callback")
        val result = listener.awaitCallback(timeoutSeconds = 5)

        assertIs<LoopbackCallbackResult.Malformed>(result)
    }

    @Test
    fun closeReleasesPortWithoutAwaitingAndIsIdempotent() {
        val listener = JvmLoopbackRedirectListener()
        val port = listener.port

        listener.close()
        listener.close()

        assertFailsWith<ConnectException> { get("http://127.0.0.1:$port/callback?code=c&state=s") }
    }

    @Test
    fun closeUnblocksPendingAwait() {
        val listener = JvmLoopbackRedirectListener()
        Thread {
            Thread.sleep(200)
            listener.close()
        }.start()

        val result = listener.awaitCallback(timeoutSeconds = 5)

        assertIs<LoopbackCallbackResult.Malformed>(result)
    }

    @Test
    fun interruptedAwaitStopsServer() {
        val listener = JvmLoopbackRedirectListener()
        val port = listener.port
        var result: LoopbackCallbackResult? = null
        val waiter = Thread { result = listener.awaitCallback(timeoutSeconds = 30) }
        waiter.start()
        Thread.sleep(200)

        waiter.interrupt()
        waiter.join(5_000)

        assertIs<LoopbackCallbackResult.Malformed>(result)
        assertFailsWith<ConnectException> { get("http://127.0.0.1:$port/callback") }
    }
}
