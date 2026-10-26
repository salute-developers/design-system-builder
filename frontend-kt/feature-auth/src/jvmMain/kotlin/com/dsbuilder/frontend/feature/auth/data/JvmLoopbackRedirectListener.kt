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
        server.createContext("/") { exchange ->
            val query = exchange.requestURI.parseQuery()
            val result = if (exchange.requestMethod == "GET" && exchange.requestURI.rawPath == "/callback") {
                parseResult(query)
            } else {
                LoopbackCallbackResult.Malformed
            }

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

    private fun parseResult(query: Map<String, List<String>>): LoopbackCallbackResult = when {
        query["error"] != null -> LoopbackCallbackResult.Error(
            error = query.getValue("error").singleOrNull() ?: "invalid_request",
            errorDescription = query["error_description"]?.singleOrNull(),
        )
        query["code"]?.singleOrNull() != null &&
            query["state"]?.singleOrNull() != null -> LoopbackCallbackResult.Success(
            code = query.getValue("code").single(),
            state = query.getValue("state").single(),
        )
        else -> LoopbackCallbackResult.Malformed
    }

    private fun URI.parseQuery(): Map<String, List<String>> =
        rawQuery.orEmpty()
            .split("&")
            .filter { it.isNotBlank() }
            .map { it.split("=", limit = 2) }
            .groupBy(
                keySelector = { URLDecoder.decode(it[0], "UTF-8") },
                valueTransform = { URLDecoder.decode(it.getOrElse(1) { "" }, "UTF-8") },
            )
}

/**
 * [RedirectListenerFactory] на JVM — новый [JvmLoopbackRedirectListener] на каждый вызов.
 */
public class JvmRedirectListenerFactory : RedirectListenerFactory {
    override fun create(): RedirectListener = JvmLoopbackRedirectListener()
}
