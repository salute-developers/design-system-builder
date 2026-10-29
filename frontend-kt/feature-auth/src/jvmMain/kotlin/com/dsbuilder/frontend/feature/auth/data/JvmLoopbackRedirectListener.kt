package com.dsbuilder.frontend.feature.auth.data

import com.dsbuilder.frontend.feature.auth.application.LoopbackCallbackResult
import com.dsbuilder.frontend.feature.auth.application.RedirectListener
import com.dsbuilder.frontend.feature.auth.application.RedirectListenerFactory
import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import java.net.URI
import java.net.URLDecoder
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

private const val CALLBACK_PAGE =
    "<html><body>You can close this tab and return to the IDE.</body></html>"

/**
 * Временный HTTP-сервер на `127.0.0.1:{эфемерный порт}`, принимающий ровно один OAuth redirect
 * на `/callback`, после чего останавливается.
 */
public class JvmLoopbackRedirectListener : RedirectListener {
    private val server: HttpServer = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
    private val resultFuture = CompletableFuture<LoopbackCallbackResult>()
    private val closed = AtomicBoolean(false)

    override val port: Int get() = server.address.port

    init {
        server.createContext("/callback") { exchange ->
            val query = exchange.requestURI.parseQuery()
            val result = parseResult(query)

            val responseBody = CALLBACK_PAGE.toByteArray()
            exchange.responseHeaders.add("Content-Type", "text/html; charset=utf-8")
            exchange.sendResponseHeaders(200, responseBody.size.toLong())
            exchange.responseBody.use { it.write(responseBody) }

            resultFuture.complete(result)
        }
        server.start()
    }

    /**
     * Блокирующе ждёт redirect, максимум [timeoutSeconds]. Останавливает сервер после получения
     * ответа, по таймауту или прерыванию потока — вызывающая сторона должна выполнять это на
     * background-потоке.
     */
    @Suppress("TooGenericExceptionCaught")
    override fun awaitCallback(timeoutSeconds: Long): LoopbackCallbackResult = try {
        resultFuture.get(timeoutSeconds, TimeUnit.SECONDS)
    } catch (exception: Exception) {
        LoopbackCallbackResult.Malformed
    } finally {
        close()
    }

    override fun close() {
        if (closed.compareAndSet(false, true)) {
            server.stop(0)
            resultFuture.complete(LoopbackCallbackResult.Malformed)
        }
    }

    private fun parseResult(query: Map<String, String>): LoopbackCallbackResult = when {
        query["error"] != null -> LoopbackCallbackResult.Error(
            error = query.getValue("error"),
            errorDescription = query["error_description"],
        )
        query["code"] != null && query["state"] != null -> LoopbackCallbackResult.Success(
            code = query.getValue("code"),
            state = query.getValue("state"),
        )
        else -> LoopbackCallbackResult.Malformed
    }

    private fun URI.parseQuery(): Map<String, String> =
        query.orEmpty()
            .split("&")
            .filter { it.isNotBlank() }
            .associate { pair ->
                val parts = pair.split("=", limit = 2)
                val key = parts[0]
                val value = parts.getOrElse(1) { "" }
                key to URLDecoder.decode(value, "UTF-8")
            }
}

/**
 * [RedirectListenerFactory] на JVM — новый [JvmLoopbackRedirectListener] на каждый вызов.
 */
public class JvmRedirectListenerFactory : RedirectListenerFactory {
    override fun create(): RedirectListener = JvmLoopbackRedirectListener()
}
