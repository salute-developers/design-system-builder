package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.auth.OAuthCallback
import com.dsbuilder.frontend.core.auth.OAuthCallbackListener
import com.dsbuilder.frontend.core.auth.PkceChallenge
import com.dsbuilder.frontend.core.auth.PkceGenerator
import com.dsbuilder.frontend.core.auth.PkcePlatform
import com.dsbuilder.frontend.feature.auth.presentation.BrowserLoginPage
import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.awt.Desktop
import java.net.InetSocketAddress
import java.net.URI
import java.net.URLDecoder
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

internal object JvmPkcePlatform : PkcePlatform {
    override fun generate(): PkceChallenge {
        val pair = PkceGenerator.generate()
        return PkceChallenge(pair.codeVerifier, pair.codeChallenge, PkceGenerator.generate().codeVerifier)
    }

    override suspend fun listen(): OAuthCallbackListener = JvmCallbackListener()

    override suspend fun openBrowser(url: String) = withContext(Dispatchers.IO) {
        check(Desktop.isDesktopSupported() && Desktop.getDesktop().isSupported(Desktop.Action.BROWSE))
        Desktop.getDesktop().browse(URI(url))
    }

    override fun currentTimeMillis(): Long = System.currentTimeMillis()
}

private class JvmCallbackListener : OAuthCallbackListener {
    private val callback = CompletableDeferred<OAuthCallback>()
    private val outcome = CompletableFuture<Boolean>()
    private val sent = CompletableDeferred<Unit>()
    private val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
    override val port: Int = server.address.port

    init {
        server.createContext("/") { exchange ->
            val result = runCatching {
                if (exchange.requestMethod == "GET") {
                    val params = exchange.requestURI.rawQuery.orEmpty().split('&').filter { it.isNotEmpty() }
                        .map { it.split('=', limit = 2) }
                        .groupBy(
                            keySelector = { URLDecoder.decode(it[0], "UTF-8") },
                            valueTransform = { URLDecoder.decode(it.getOrElse(1) { "" }, "UTF-8") },
                        )
                    OAuthCallback(exchange.requestURI.rawPath, params)
                } else {
                    OAuthCallback("", emptyMap())
                }
            }.getOrElse { OAuthCallback("", emptyMap()) }
            val accepted = callback.complete(result)
            try {
                val success = accepted && outcome.get(181, TimeUnit.SECONDS)
                val body = BrowserLoginPage.render(success).toByteArray(Charsets.UTF_8)
                BrowserLoginPage.headers.forEach { (name, value) -> exchange.responseHeaders.set(name, value) }
                exchange.sendResponseHeaders(if (!accepted) 409 else if (success) 200 else 400, body.size.toLong())
                exchange.responseBody.use { it.write(body) }
            } finally {
                exchange.close()
                if (accepted) sent.complete(Unit)
            }
        }
        server.start()
    }

    override suspend fun awaitCallback(): OAuthCallback = callback.await()

    override suspend fun complete(success: Boolean) {
        outcome.complete(success)
        if (callback.isCompleted && !callback.isCancelled) sent.await()
    }

    override fun close() {
        outcome.complete(false)
        server.stop(0)
        callback.cancel()
    }
}
