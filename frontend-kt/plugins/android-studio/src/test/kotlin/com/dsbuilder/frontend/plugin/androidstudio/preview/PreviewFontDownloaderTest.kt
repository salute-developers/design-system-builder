package com.dsbuilder.frontend.plugin.androidstudio.preview

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import kotlinx.coroutines.runBlocking
import java.net.InetAddress
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class PreviewFontDownloaderTest {
    @Test
    fun rejectsPrivateAddressesFromLiteralsAndDnsBeforeCreatingClient() = runBlocking {
        for (address in listOf(
            "127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254",
            "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1",
        )) {
            PreviewFontDownloader(
                { listOf(InetAddress.getByName(address)) },
                { error("Client must not be created for a private destination") },
            ).use { downloader ->
                assertFailsWith<IllegalArgumentException> { downloader.download("https://internal.example/font.otf") }
            }
        }
    }

    @Test
    fun pinsValidatedIpAndRetainsOriginalTlsIdentityAndHostHeader() = runBlocking {
        var lookups = 0
        var requests = 0
        val bytes = "OTTO".toByteArray() + ByteArray(8)
        val http = HttpClient(
            MockEngine { request ->
                requests++
                assertEquals("https://8.8.8.8:8443/font.otf?version=1", request.url.toString())
                assertEquals("fonts.example:8443", request.headers["Host"])
                respond(bytes)
            },
        )
        PreviewFontDownloader(
            {
                lookups++
                listOf(InetAddress.getByName(if (lookups == 1) "8.8.8.8" else "127.0.0.1"))
            },
            { host ->
                assertEquals("fonts.example", host)
                http
            },
        ).use { downloader ->
            assertContentEquals(bytes, downloader.download("https://fonts.example:8443/font.otf?version=1"))
            assertEquals(1, lookups)
            assertFailsWith<IllegalArgumentException> {
                downloader.download(
                    "https://fonts.example:8443/font.otf?version=1",
                )
            }
            assertEquals(1, requests)
        }
    }
}
