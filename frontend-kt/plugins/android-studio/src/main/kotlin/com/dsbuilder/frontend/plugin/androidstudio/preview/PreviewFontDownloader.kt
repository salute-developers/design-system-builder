package com.dsbuilder.frontend.plugin.androidstudio.preview

import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.header
import io.ktor.client.request.prepareGet
import io.ktor.client.request.url
import io.ktor.client.statement.bodyAsChannel
import io.ktor.http.HttpHeaders
import io.ktor.utils.io.readRemaining
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.io.readByteArray
import java.net.InetAddress
import java.net.URI
import java.util.concurrent.ConcurrentHashMap

/** Проверяет DNS и закрепляет соединение за проверенным публичным IP; TLS и Host используют исходное имя. */
internal class PreviewFontDownloader(
    private val resolve: suspend (String) -> List<InetAddress> = { host ->
        withContext(Dispatchers.IO) { InetAddress.getAllByName(host).toList() }
    },
    private val clientForHost: (String) -> HttpClient = { host ->
        HttpClient(CIO) {
            followRedirects = false
            engine { https { serverName = host } }
            install(HttpTimeout) {
                requestTimeoutMillis = 15_000
                connectTimeoutMillis = 10_000
                socketTimeoutMillis = 15_000
            }
        }
    },
) : AutoCloseable {
    private val clients = ConcurrentHashMap<String, HttpClient>()

    @Volatile
    private var closed = false

    suspend fun download(url: String): ByteArray {
        check(!closed) { "Сессия превью закрыта" }
        val uri = URI(url)
        require(uri.scheme == "https" && uri.host != null && uri.userInfo == null) { "Некорректный HTTPS-адрес шрифта" }
        val addresses = resolve(uri.host)
        require(
            addresses.isNotEmpty() && addresses.all(::publicFontAddress),
        ) { "Шрифт должен находиться в публичной сети" }
        val http = synchronized(clients) {
            check(!closed) { "Сессия превью закрыта" }
            clients.computeIfAbsent(uri.host, clientForHost)
        }
        val request = HttpRequestBuilder().apply {
            url(url)
            this.url.host = addresses.first().hostAddress
            header(HttpHeaders.Host, uri.rawAuthority)
        }
        return http.prepareGet(request).execute { response ->
            check(response.status.value == 200) { "Файл шрифта недоступен: HTTP ${response.status.value}" }
            val length = response.headers[HttpHeaders.ContentLength]?.toLongOrNull()
            check(length == null || length <= MAX_FONT_BYTES) { "Файл шрифта слишком большой" }
            response.bodyAsChannel().readRemaining(MAX_FONT_BYTES + 1L).readByteArray()
        }
    }

    override fun close() {
        synchronized(clients) {
            closed = true
            clients.values.forEach(HttpClient::close)
            clients.clear()
        }
    }

    companion object {
        const val MAX_FONT_BYTES = 4 * 1024 * 1024
    }
}

private fun publicFontAddress(address: InetAddress): Boolean {
    val bytes = address.address
    return if (bytes.size == 4) {
        deniedFontIpv4.none { it.contains(bytes) }
    } else {
        globalFontIpv6.contains(bytes) && deniedFontIpv6.none { it.contains(bytes) }
    }
}

private class FontNetwork(cidr: String) {
    private val network = InetAddress.getByName(cidr.substringBefore('/')).address
    private val prefix = cidr.substringAfter('/').toInt()

    fun contains(address: ByteArray): Boolean = address.size == network.size && network.indices.all { index ->
        val bits = (prefix - index * 8).coerceIn(0, 8)
        val mask = (0xff shl (8 - bits)) and 0xff
        address[index].toInt() and mask == network[index].toInt() and mask
    }
}

private val deniedFontIpv4 = listOf(
    "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12",
    "192.0.0.0/24", "192.0.2.0/24", "192.88.99.0/24", "192.168.0.0/16", "198.18.0.0/15",
    "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4",
).map(::FontNetwork)
private val globalFontIpv6 = FontNetwork("2000::/3")
private val deniedFontIpv6 = listOf("2001::/23", "2001:db8::/32", "2002::/16").map(::FontNetwork)
