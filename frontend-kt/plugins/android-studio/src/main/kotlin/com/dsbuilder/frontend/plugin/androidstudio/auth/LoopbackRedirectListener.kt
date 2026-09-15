package com.dsbuilder.frontend.plugin.androidstudio.auth

import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import java.net.URI
import java.net.URLDecoder
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

private const val DEFAULT_TIMEOUT_SECONDS = 300L
private const val CALLBACK_PAGE =
    "<html><body>You can close this tab and return to the IDE.</body></html>"

/**
 * Результат redirect на loopback callback плагина.
 */
public sealed interface LoopbackCallbackResult {
    /**
     * Authorization code получен.
     *
     * @property code authorization code для обмена на токены.
     * @property state значение `state`, полученное обратно от Keycloak — подлежит сверке с ожидаемым.
     */
    public data class Success(public val code: String, public val state: String) : LoopbackCallbackResult

    /**
     * Keycloak вернул OAuth-ошибку вместо кода.
     *
     * @property error код ошибки OAuth (например `access_denied`).
     * @property errorDescription человекочитаемое описание ошибки, если Keycloak его передал.
     */
    public data class Error(public val error: String, public val errorDescription: String?) : LoopbackCallbackResult

    /** Redirect не содержит ни кода, ни признанной ошибки. */
    public data object Malformed : LoopbackCallbackResult
}

/**
 * Порт ожидания OAuth redirect на loopback-адрес. Отдельный интерфейс — чтобы [LoginController]
 * можно было тестировать без реального сетевого сервера.
 */
public interface RedirectListener {
    /** Порт, на котором слушает сервер — используется для построения `redirect_uri`. */
    public val port: Int

    /** Блокирующе ждёт redirect, максимум [timeoutSeconds]. */
    public fun awaitCallback(timeoutSeconds: Long = DEFAULT_TIMEOUT_SECONDS): LoopbackCallbackResult
}

/**
 * Временный HTTP-сервер на `127.0.0.1:{эфемерный порт}`, принимающий ровно один OAuth redirect
 * на `/callback`, после чего останавливается.
 */
public class LoopbackRedirectListener : RedirectListener {
    private val server: HttpServer = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
    private val resultFuture = CompletableFuture<LoopbackCallbackResult>()

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
     * ответа или по таймауту — вызывающая сторона должна выполнять это на background-потоке.
     */
    @Suppress("TooGenericExceptionCaught")
    override fun awaitCallback(timeoutSeconds: Long): LoopbackCallbackResult = try {
        resultFuture.get(timeoutSeconds, TimeUnit.SECONDS)
    } catch (exception: Exception) {
        LoopbackCallbackResult.Malformed
    } finally {
        server.stop(0)
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
