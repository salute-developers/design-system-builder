package com.dsbuilder.frontend.mcpnode

import com.dsbuilder.frontend.core.auth.OAuthCallback
import com.dsbuilder.frontend.core.auth.OAuthCallbackListener
import com.dsbuilder.frontend.core.auth.PkceChallenge
import com.dsbuilder.frontend.core.auth.PkcePlatform
import com.dsbuilder.frontend.feature.auth.presentation.BrowserLoginPage
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

private val crypto: dynamic = js("require('crypto')")
private val http: dynamic = js("require('http')")
private val childProcess: dynamic = js("require('child_process')")
private val process: dynamic = js("process")
private val urls: dynamic = js("require('url')")

internal object NodePkcePlatform : PkcePlatform {
    override fun generate(): PkceChallenge {
        val verifier = crypto.randomBytes(64).toString("base64url") as String
        val challenge = crypto.createHash("sha256").update(verifier).digest("base64url") as String
        return PkceChallenge(verifier, challenge, crypto.randomBytes(32).toString("base64url") as String)
    }

    override suspend fun listen(): OAuthCallbackListener {
        val listener = NodeCallbackListener()
        listener.start()
        return listener
    }

    override suspend fun openBrowser(url: String): Unit = suspendCancellableCoroutine { continuation ->
        val platform = process.platform as String
        val command = when (platform) {
            "darwin" -> "open"
            "win32" -> "rundll32"
            else -> "xdg-open"
        }
        val args = if (platform == "win32") arrayOf("url.dll,FileProtocolHandler", url) else arrayOf(url)
        val child = childProcess.spawn(command, args, js("({stdio:'ignore'})"))
        child.once("error", { _: dynamic ->
            if (continuation.isActive) continuation.resumeWithException(IllegalStateException("Браузер недоступен."))
        })
        child.once("exit", { code: dynamic ->
            if (continuation.isActive) {
                if (code == 0) {
                    continuation.resume(Unit)
                } else {
                    continuation.resumeWithException(IllegalStateException("Браузер недоступен."))
                }
            }
        })
        continuation.invokeOnCancellation { child.kill() }
    }

    override fun currentTimeMillis(): Long = (js("Date.now()") as Double).toLong()
}

private class NodeCallbackListener : OAuthCallbackListener {
    private val callback = CompletableDeferred<OAuthCallback>()
    private var pendingResponse: dynamic = null
    private var closed = false
    private val server: dynamic = http.createServer { request: dynamic, response: dynamic ->
        val url = urls.parse(request.url, true)
        val params = mutableMapOf<String, List<String>>()
        val query = url.query
        val keys = js("Object.keys(query)") as Array<String>
        for (key in keys) {
            val value = query[key]
            params[key] = if (js("Array.isArray(value)") as Boolean) {
                (value as Array<String>).toList()
            } else {
                listOf(value as String)
            }
        }
        val path = if (request.method == "GET") url.pathname as String else ""
        if (callback.isCompleted) {
            respond(response, 409)
            response.end(BrowserLoginPage.render(false))
        } else {
            pendingResponse = response
            callback.complete(OAuthCallback(path, params))
        }
    }
    override val port: Int get() = server.address().port as Int

    suspend fun start(): Unit = suspendCancellableCoroutine { continuation ->
        server.once("error", { _: dynamic ->
            if (continuation.isActive) continuation.resumeWithException(IllegalStateException("Listener недоступен."))
        })
        server.listen(0, "127.0.0.1", {
            if (continuation.isActive) continuation.resume(Unit) else server.close()
        })
        continuation.invokeOnCancellation { server.close() }
    }

    override suspend fun awaitCallback(): OAuthCallback = callback.await()

    override suspend fun complete(success: Boolean) {
        val response = pendingResponse ?: return
        pendingResponse = null
        suspendCancellableCoroutine<Unit> { continuation ->
            response.once("error", { _: dynamic ->
                if (continuation.isActive) continuation.resume(Unit)
            })
            respond(response, if (success) 200 else 400)
            response.end(BrowserLoginPage.render(success), {
                if (continuation.isActive) continuation.resume(Unit)
            })
        }
    }

    private fun respond(response: dynamic, status: Int) {
        BrowserLoginPage.headers.forEach { (name, value) -> response.setHeader(name, value) }
        response.writeHead(status)
    }

    override fun close() {
        if (closed) return
        closed = true
        server.close()
        server.closeAllConnections()
        callback.cancel()
    }
}
