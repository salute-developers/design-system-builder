@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class, kotlin.time.ExperimentalTime::class)

package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.auth.OAuthCallback
import com.dsbuilder.frontend.core.auth.OAuthCallbackListener
import com.dsbuilder.frontend.core.auth.PkceChallenge
import com.dsbuilder.frontend.core.auth.PkcePlatform
import com.dsbuilder.frontend.feature.auth.presentation.BrowserLoginPage
import io.ktor.http.parseQueryString
import kotlinx.cinterop.UIntVar
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
import platform.posix.WSADATA
import platform.posix.recv
import platform.posix.send
import platform.posix.sockaddr_in
import platform.windows.AF_INET
import platform.windows.BCRYPT_USE_SYSTEM_PREFERRED_RNG
import platform.windows.BCryptCloseAlgorithmProvider
import platform.windows.BCryptCreateHash
import platform.windows.BCryptDestroyHash
import platform.windows.BCryptFinishHash
import platform.windows.BCryptGenRandom
import platform.windows.BCryptHashData
import platform.windows.BCryptOpenAlgorithmProvider
import platform.windows.FIONBIO
import platform.windows.SOCK_STREAM
import platform.windows.ShellExecuteW
import platform.windows.WSACleanup
import platform.windows.WSAEWOULDBLOCK
import platform.windows.WSAGetLastError
import platform.windows.WSAStartup
import platform.windows.accept
import platform.windows.bind
import platform.windows.closesocket
import platform.windows.getsockname
import platform.windows.htons
import platform.windows.inet_addr
import platform.windows.ioctlsocket
import platform.windows.listen
import platform.windows.ntohs
import platform.windows.socket
import kotlin.io.encoding.Base64
import kotlin.time.Clock

/** Системная PKCE-реализация Windows. */
internal object WindowsPkcePlatform : PkcePlatform {
    override fun generate(): PkceChallenge {
        val encoder = Base64.UrlSafe.withPadding(Base64.PaddingOption.ABSENT)
        val verifier = encoder.encode(randomBytes(64))
        return PkceChallenge(
            verifier,
            encoder.encode(sha256(verifier.encodeToByteArray())),
            encoder.encode(randomBytes(32)),
        )
    }

    private fun randomBytes(size: Int): ByteArray = ByteArray(size).also { bytes ->
        bytes.usePinned { pinned ->
            check(
                BCryptGenRandom(
                    null, pinned.addressOf(0).reinterpret(), size.toUInt(),
                    BCRYPT_USE_SYSTEM_PREFERRED_RNG.toUInt(),
                ) >= 0,
            )
        }
    }

    private fun sha256(bytes: ByteArray): ByteArray = memScoped {
        val algorithm = alloc<platform.windows.BCRYPT_ALG_HANDLEVar>()
        check(BCryptOpenAlgorithmProvider(algorithm.ptr, "SHA256", null, 0u) >= 0)
        try {
            val hash = alloc<platform.windows.BCRYPT_HASH_HANDLEVar>()
            check(BCryptCreateHash(algorithm.value, hash.ptr, null, 0u, null, 0u, 0u) >= 0)
            try {
                bytes.usePinned { pinned ->
                    check(BCryptHashData(hash.value, pinned.addressOf(0).reinterpret(), bytes.size.toUInt(), 0u) >= 0)
                }
                ByteArray(32).also { digest ->
                    digest.usePinned { pinned ->
                        check(BCryptFinishHash(hash.value, pinned.addressOf(0).reinterpret(), 32u, 0u) >= 0)
                    }
                }
            } finally {
                BCryptDestroyHash(hash.value)
            }
        } finally {
            BCryptCloseAlgorithmProvider(algorithm.value, 0u)
        }
    }

    override suspend fun listen(): OAuthCallbackListener = WindowsCallbackListener()

    override suspend fun openBrowser(url: String) {
        val result = ShellExecuteW(null, "open", url, null, null, 1)
        check((result?.rawValue?.toLong() ?: 0L) > 32L) { "Браузер недоступен." }
    }

    override fun currentTimeMillis(): Long = Clock.System.now().toEpochMilliseconds()
}

private const val INVALID_WINDOWS_SOCKET: ULong = ULong.MAX_VALUE

private class WindowsCallbackListener : OAuthCallbackListener {
    private var initialized = false
    private var socketHandle: platform.posix.SOCKET = INVALID_WINDOWS_SOCKET
    private var pendingClient: platform.posix.SOCKET = INVALID_WINDOWS_SOCKET
    override val port: Int

    init {
        memScoped {
            val data = alloc<WSADATA>()
            check(WSAStartup(0x0202u, data.ptr) == 0)
            initialized = true
        }
        try {
            socketHandle = socket(AF_INET, SOCK_STREAM, 0)
            check(socketHandle != INVALID_WINDOWS_SOCKET)
            port = memScoped {
                val address = alloc<sockaddr_in>()
                address.sin_family = AF_INET.convert()
                address.sin_port = htons(0u)
                address.sin_addr.S_un.S_addr = inet_addr("127.0.0.1").toUInt()
                check(bind(socketHandle, address.ptr.reinterpret(), sizeOf<sockaddr_in>().convert()) == 0)
                check(listen(socketHandle, 1) == 0)
                val length = alloc<kotlinx.cinterop.IntVar>()
                length.value = sizeOf<sockaddr_in>().toInt()
                check(getsockname(socketHandle, address.ptr.reinterpret(), length.ptr) == 0)
                val nonblocking = alloc<UIntVar>()
                nonblocking.value = 1u
                check(ioctlsocket(socketHandle, FIONBIO.toInt(), nonblocking.ptr) == 0)
                ntohs(address.sin_port).toInt()
            }
        } catch (error: Throwable) {
            close()
            throw error
        }
    }

    override suspend fun awaitCallback(): OAuthCallback {
        while (socketHandle != INVALID_WINDOWS_SOCKET) {
            val client = accept(socketHandle, null, null)
            if (client == INVALID_WINDOWS_SOCKET) {
                check(WSAGetLastError() == WSAEWOULDBLOCK)
                delay(20)
                continue
            }
            pendingClient = client
            memScoped {
                val nonblocking = alloc<UIntVar>()
                nonblocking.value = 1u
                check(ioctlsocket(client, FIONBIO.toInt(), nonblocking.ptr) == 0)
            }
            val request = StringBuilder()
            val buffer = ByteArray(1024)
            while (!request.contains("\r\n\r\n") && request.length <= 8192) {
                val count = buffer.usePinned { recv(client, it.addressOf(0), buffer.size, 0) }
                if (count == 0) return OAuthCallback("", emptyMap())
                if (count < 0) {
                    check(WSAGetLastError() == WSAEWOULDBLOCK)
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
        if (pendingClient == INVALID_WINDOWS_SOCKET) return
        val body = BrowserLoginPage.render(success).encodeToByteArray()
        val headers = BrowserLoginPage.headers.entries.joinToString("\r\n") { "${it.key}: ${it.value}" }
        val status = if (success) "200 OK" else "400 Bad Request"
        val response = (
            "HTTP/1.1 $status\r\n$headers\r\nContent-Length: ${body.size}\r\n" +
                "Connection: close\r\n\r\n"
            ).encodeToByteArray() + body
        var offset = 0
        while (offset < response.size) {
            val count = response.usePinned { send(pendingClient, it.addressOf(offset), response.size - offset, 0) }
            if (count < 0) {
                check(WSAGetLastError() == WSAEWOULDBLOCK)
                delay(20)
            } else {
                check(count > 0)
                offset += count
            }
        }
    }

    override fun close() {
        if (pendingClient != INVALID_WINDOWS_SOCKET) closesocket(pendingClient)
        pendingClient = INVALID_WINDOWS_SOCKET
        if (socketHandle != INVALID_WINDOWS_SOCKET) closesocket(socketHandle)
        socketHandle = INVALID_WINDOWS_SOCKET
        if (initialized) {
            WSACleanup()
            initialized = false
        }
    }
}
