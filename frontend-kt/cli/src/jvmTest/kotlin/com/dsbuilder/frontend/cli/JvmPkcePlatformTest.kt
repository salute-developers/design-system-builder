package com.dsbuilder.frontend.cli

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.ServerSocket
import java.net.URI
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class JvmPkcePlatformTest {
    @Test
    fun listenerWaitsForSavedSessionWritesUtf8AndRejectsReplay() = runBlocking {
        val listener = JvmPkcePlatform.listen()
        val port = listener.port
        try {
            val response = async(Dispatchers.IO) { request(port, "/callback?code=private-code&state=private-state") }
            val callback = listener.awaitCallback()
            assertEquals(listOf("private-code"), callback.parameters["code"])
            assertFalse(response.isCompleted)
            listener.complete(true)
            val page = response.await()
            assertEquals(200, page.status)
            assertTrue(page.body.contains("Вы успешно авторизованы"))
            assertTrue(page.body.contains("Можете закрыть вкладку."))
            assertFalse(page.body.contains("private-code"))
            assertFalse(page.body.contains("private-state"))
            assertEquals("text/html; charset=utf-8", page.contentType)
            assertEquals("no-store", page.cacheControl)
            assertEquals("no-referrer", page.referrerPolicy)
            assertEquals(page.body.toByteArray(Charsets.UTF_8).size, page.contentLength)
            val replay = async(Dispatchers.IO) { request(port, "/callback?code=replay&state=state") }.await()
            assertEquals(409, replay.status)
            assertFalse(replay.body.contains("Вы успешно авторизованы"))
        } finally {
            listener.close()
        }
        ServerSocket(port, 1, InetAddress.getByName("127.0.0.1")).use { assertEquals(port, it.localPort) }
    }

    @Test
    fun invalidCallbackCanOnlyReceiveFailurePage() = runBlocking {
        val listener = JvmPkcePlatform.listen()
        try {
            val response = async(Dispatchers.IO) { request(listener.port, "/wrong?code=a&code=b&state=state") }
            val callback = listener.awaitCallback()
            assertEquals("/wrong", callback.path)
            assertEquals(listOf("a", "b"), callback.parameters["code"])
            listener.complete(false)
            assertEquals(400, response.await().status)
            assertTrue(response.await().body.contains("Не удалось завершить вход"))
        } finally {
            listener.close()
        }
    }

    @Test
    fun disconnectedBrowserDoesNotBlockCompletion() = runBlocking {
        val listener = JvmPkcePlatform.listen()
        try {
            java.net.Socket("127.0.0.1", listener.port).use { socket ->
                socket.getOutputStream().write(
                    "GET /callback?code=a&state=b HTTP/1.1\r\nHost: localhost\r\n\r\n".toByteArray(),
                )
                socket.getOutputStream().flush()
                listener.awaitCallback()
            }
            listener.complete(true)
        } finally {
            listener.close()
        }
    }

    private fun request(port: Int, path: String): Page {
        val connection = URI("http://127.0.0.1:$port$path").toURL().openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 2000
            connection.readTimeout = 5000
            val status = connection.responseCode
            val stream = if (status >= 400) connection.errorStream else connection.inputStream
            return Page(
                status,
                stream.bufferedReader(Charsets.UTF_8).use { it.readText() },
                connection.contentType,
                connection.contentLength,
                connection.getHeaderField("Cache-Control"),
                connection.getHeaderField("Referrer-Policy"),
            )
        } finally {
            connection.disconnect()
        }
    }

    private data class Page(
        val status: Int,
        val body: String,
        val contentType: String,
        val contentLength: Int,
        val cacheControl: String,
        val referrerPolicy: String,
    )
}
