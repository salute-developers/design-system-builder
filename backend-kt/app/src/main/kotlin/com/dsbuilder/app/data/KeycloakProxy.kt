package com.dsbuilder.app.data

import com.dsbuilder.app.GatewayConfiguration
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.network.sockets.ConnectTimeoutException
import io.ktor.client.network.sockets.SocketTimeoutException
import io.ktor.client.plugins.HttpRequestTimeoutException
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.prepareRequest
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsChannel
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.httpMethod
import io.ktor.server.request.receiveChannel
import io.ktor.server.request.uri
import io.ktor.server.response.respond
import io.ktor.server.response.respondBytes
import io.ktor.server.response.respondBytesWriter
import io.ktor.utils.io.copyTo
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import java.io.IOException

/** Потоковый прокси только к настроенному Keycloak, без произвольного адреса назначения. */
class KeycloakProxy(
    private val configuration: GatewayConfiguration,
    suppliedClient: HttpClient? = null,
) : AutoCloseable {
    private val client = suppliedClient ?: HttpClient(CIO) {
        followRedirects = false
        expectSuccess = false
        install(HttpTimeout) {
            connectTimeoutMillis = 10_000
            socketTimeoutMillis = configuration.timeoutSeconds * 1000
            requestTimeoutMillis = null
        }
    }

    /** Сохраняет метод, query, cookies и несколько Set-Cookie без следования редиректам. */
    suspend fun forward(call: ApplicationCall, upstreamPath: String) {
        require(upstreamPath.startsWith("/") && !upstreamPath.startsWith("//"))
        val query = call.request.uri.substringAfter('?', "")
        val url = configuration.keycloakUrl + upstreamPath + if (query.isEmpty()) "" else "?$query"
        try {
            client.prepareRequest(url) { copyRequest(call) }.execute { upstream ->
                forwardResponse(call, upstream)
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (failure: IOException) {
            if (call.response.isCommitted) throw failure
            call.respond(
                if (failure is ConnectTimeoutException || failure is SocketTimeoutException) {
                    HttpStatusCode.GatewayTimeout
                } else {
                    HttpStatusCode.BadGateway
                },
            )
        } catch (failure: HttpRequestTimeoutException) {
            requireUncommitted(call, failure)
            call.respond(HttpStatusCode.GatewayTimeout)
        }
    }

    private fun requireUncommitted(call: ApplicationCall, failure: Exception) {
        if (call.response.isCommitted) throw failure
    }

    private fun requestHeaderAllowed(name: String, connectionHeaders: Set<String>): Boolean =
        name.lowercase() !in hopHeaders + connectionHeaders + com.dsbuilder.app.presentation.trustedNames &&
            !name.startsWith("X-Forwarded-", ignoreCase = true) &&
            name.lowercase() !in setOf("host", "content-length")

    private fun responseHeaderAllowed(name: String, connectionHeaders: Set<String>): Boolean =
        !name.startsWith("Access-Control-", ignoreCase = true) &&
            name.lowercase() !in hopHeaders + connectionHeaders + setOf("content-length", "content-type")

    private suspend fun io.ktor.client.request.HttpRequestBuilder.copyRequest(call: ApplicationCall) {
        val connectionHeaders = call.request.headers[HttpHeaders.Connection].orEmpty()
            .split(',').map(String::trim).map(String::lowercase).toSet()
        method = call.request.httpMethod
        call.request.headers.forEach { name, values ->
            if (requestHeaderAllowed(name, connectionHeaders)) {
                headers.appendAll(name, values)
            }
        }
        val publicAddress = java.net.URI(configuration.publicUrl)
        headers.append(
            "X-Forwarded-For",
            call.request.local.remoteHost,
        )
        headers.append("X-Forwarded-Proto", publicAddress.scheme)
        headers.append("X-Forwarded-Host", publicAddress.rawAuthority)
        val port = publicAddress.port.takeIf { it >= 0 } ?: if (publicAddress.scheme == "https") 443 else 80
        headers.append("X-Forwarded-Port", port.toString())
        if (call.request.httpMethod.value !in setOf("GET", "HEAD")) setBody(call.receiveChannel())
    }

    // Любая ошибка копирования завершает ожидающий upstream и передаётся без изменения.
    @Suppress("TooGenericExceptionCaught")
    private suspend fun forwardResponse(call: ApplicationCall, upstream: io.ktor.client.statement.HttpResponse) {
        val responseConnectionHeaders = upstream.headers[HttpHeaders.Connection].orEmpty()
            .split(',').map(String::trim).map(String::lowercase).toSet()
        upstream.headers.forEach { name, values ->
            if (responseHeaderAllowed(name, responseConnectionHeaders)) {
                values.forEach { call.response.headers.append(name, it, safeOnly = false) }
            }
        }
        if (call.request.httpMethod.value == "HEAD" || upstream.status.value in setOf(204, 304)) {
            call.respondBytes(ByteArray(0), upstream.contentType(), upstream.status)
        } else {
            val completed = CompletableDeferred<Unit>()
            call.respondBytesWriter(
                upstream.contentType() ?: ContentType.Application.OctetStream,
                upstream.status,
            ) {
                try {
                    upstream.bodyAsChannel().copyTo(this)
                    completed.complete(Unit)
                } catch (failure: Throwable) {
                    completed.completeExceptionally(failure)
                    throw failure
                }
            }
            // The server may consume WriteChannelContent after respond() returns.
            // Keep the streaming upstream response alive until that consumption finishes.
            completed.await()
        }
    }

    override fun close() = client.close()

    private companion object {
        val hopHeaders = setOf(
            "connection",
            "keep-alive",
            "proxy-authenticate",
            "proxy-authorization",
            "te",
            "trailer",
            "transfer-encoding",
            "upgrade",
        )
    }
}
