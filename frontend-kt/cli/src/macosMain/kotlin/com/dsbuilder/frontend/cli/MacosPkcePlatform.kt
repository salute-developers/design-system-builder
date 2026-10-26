@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.auth.OAuthCallback
import com.dsbuilder.frontend.core.auth.OAuthCallbackListener
import com.dsbuilder.frontend.core.auth.PkceChallenge
import com.dsbuilder.frontend.core.auth.PkcePlatform
import com.dsbuilder.frontend.feature.auth.presentation.BrowserLoginPage
import io.ktor.http.parseQueryString
import kotlinx.cinterop.IntVar
import kotlinx.cinterop.addressOf
import kotlinx.cinterop.alloc
import kotlinx.cinterop.convert
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.ptr
import kotlinx.cinterop.reinterpret
import kotlinx.cinterop.sizeOf
import kotlinx.cinterop.usePinned
import kotlinx.cinterop.value
import kotlinx.coroutines.delay
import platform.AppKit.NSWorkspace
import platform.CoreCrypto.CC_SHA256
import platform.CoreCrypto.CC_SHA256_DIGEST_LENGTH
import platform.Foundation.NSDate
import platform.Foundation.NSURL
import platform.Foundation.timeIntervalSince1970
import platform.Security.SecRandomCopyBytes
import platform.Security.kSecRandomDefault
import platform.darwin.inet_addr
import platform.posix.AF_INET
import platform.posix.EAGAIN
import platform.posix.EWOULDBLOCK
import platform.posix.F_SETFL
import platform.posix.O_NONBLOCK
import platform.posix.SOCK_STREAM
import platform.posix.SOL_SOCKET
import platform.posix.SO_NOSIGPIPE
import platform.posix.accept
import platform.posix.bind
import platform.posix.errno
import platform.posix.fcntl
import platform.posix.getsockname
import platform.posix.listen
import platform.posix.memset
import platform.posix.recv
import platform.posix.send
import platform.posix.setsockopt
import platform.posix.sockaddr_in
import platform.posix.socket
import platform.posix.socklen_tVar
import kotlin.io.encoding.Base64

internal object MacosPkcePlatform : PkcePlatform {
    override fun generate(): PkceChallenge {
        val encoder = Base64.UrlSafe.withPadding(Base64.PaddingOption.ABSENT)
        val verifier = encoder.encode(randomBytes(64))
        val digest = ByteArray(CC_SHA256_DIGEST_LENGTH)
        verifier.encodeToByteArray().usePinned { input ->
            digest.usePinned { output ->
                CC_SHA256(input.addressOf(0), verifier.length.convert(), output.addressOf(0).reinterpret())
            }
        }
        return PkceChallenge(verifier, encoder.encode(digest), encoder.encode(randomBytes(32)))
    }

    private fun randomBytes(count: Int): ByteArray = ByteArray(count).also { bytes ->
        bytes.usePinned { check(SecRandomCopyBytes(kSecRandomDefault, count.convert(), it.addressOf(0)) == 0) }
    }

    override suspend fun listen(): OAuthCallbackListener = MacosCallbackListener()

    override suspend fun openBrowser(url: String) {
        check(NSWorkspace.sharedWorkspace.openURL(NSURL.URLWithString(url)!!)) { "Браузер недоступен." }
    }

    override fun currentTimeMillis(): Long = (NSDate().timeIntervalSince1970 * 1000).toLong()
}

private class MacosCallbackListener : OAuthCallbackListener {
    private var socketFd = socket(AF_INET, SOCK_STREAM, 0).also { check(it >= 0) }
    private var pendingClient = -1
    override val port: Int

    init {
        try {
            port = memScoped {
                val address = alloc<sockaddr_in>()
                memset(address.ptr, 0, sizeOf<sockaddr_in>().convert())
                address.sin_family = AF_INET.convert()
                address.sin_len = sizeOf<sockaddr_in>().convert()
                address.sin_port = 0u
                address.sin_addr.s_addr = inet_addr("127.0.0.1")
                check(bind(socketFd, address.ptr.reinterpret(), sizeOf<sockaddr_in>().convert()) == 0)
                check(listen(socketFd, 1) == 0)
                val length = alloc<socklen_tVar>()
                length.value = sizeOf<sockaddr_in>().convert()
                check(getsockname(socketFd, address.ptr.reinterpret(), length.ptr) == 0)
                check(fcntl(socketFd, F_SETFL, O_NONBLOCK) == 0)
                ((address.sin_port.toInt() and 255) shl 8) or (address.sin_port.toInt() ushr 8)
            }
        } catch (exception: Throwable) {
            close()
            throw exception
        }
    }

    override suspend fun awaitCallback(): OAuthCallback {
        while (socketFd >= 0) {
            val client = accept(socketFd, null, null)
            if (client < 0) {
                check(errno == EAGAIN || errno == EWOULDBLOCK)
                delay(20)
                continue
            }
            pendingClient = client
            check(fcntl(client, F_SETFL, O_NONBLOCK) == 0)
            memScoped {
                val enabled = alloc<IntVar>()
                enabled.value = 1
                check(setsockopt(client, SOL_SOCKET, SO_NOSIGPIPE, enabled.ptr, sizeOf<IntVar>().convert()) == 0)
            }
            val request = StringBuilder()
            val buffer = ByteArray(1024)
            while (!request.contains("\r\n\r\n") && request.length <= 8192) {
                val count = buffer.usePinned { recv(client, it.addressOf(0), buffer.size.convert(), 0) }.toInt()
                if (count == 0) return OAuthCallback("", emptyMap())
                if (count < 0) {
                    check(errno == EAGAIN || errno == EWOULDBLOCK)
                    delay(20)
                } else {
                    request.append(buffer.decodeToString(0, count))
                }
            }
            val line = request.toString().substringBefore("\r\n").split(' ')
            if (line.size != 3 || line[0] != "GET" || request.length > 8192) {
                return OAuthCallback("", emptyMap())
            }
            val target = line[1]
            val query = parseQueryString(target.substringAfter('?', ""))
            return OAuthCallback(target.substringBefore('?'), query.entries().associate { it.key to it.value })
        }
        return OAuthCallback("", emptyMap())
    }

    override suspend fun complete(success: Boolean) {
        if (pendingClient < 0) return
        val body = BrowserLoginPage.render(success).encodeToByteArray()
        val headers = BrowserLoginPage.headers.entries.joinToString("\r\n") { "${it.key}: ${it.value}" }
        val status = if (success) "200 OK" else "400 Bad Request"
        val response = (
            "HTTP/1.1 $status\r\n$headers\r\nContent-Length: ${body.size}\r\n" +
                "Connection: close\r\n\r\n"
            ).encodeToByteArray() + body
        var offset = 0
        while (offset < response.size) {
            val count = response.usePinned {
                send(pendingClient, it.addressOf(offset), (response.size - offset).convert(), 0)
            }.toInt()
            if (count < 0) {
                check(errno == EAGAIN || errno == EWOULDBLOCK)
                delay(20)
            } else {
                check(count > 0)
                offset += count
            }
        }
    }

    override fun close() {
        if (pendingClient >= 0) platform.posix.close(pendingClient)
        pendingClient = -1
        if (socketFd >= 0) platform.posix.close(socketFd)
        socketFd = -1
    }
}
