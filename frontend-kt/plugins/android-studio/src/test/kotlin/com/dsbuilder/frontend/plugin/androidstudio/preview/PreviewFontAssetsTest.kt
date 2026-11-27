package com.dsbuilder.frontend.plugin.androidstudio.preview

import com.dsbuilder.frontend.plugin.androidstudio.api.ApiJson
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonObject
import java.net.InetAddress
import java.net.URI
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PreviewFontAssetsTest {
    private val base = URI("https://preview.example/build/.ide-fonts/session/")
    private fun assets(http: HttpClient) = PreviewFontAssets(
        base,
        PreviewFontDownloader({ listOf(InetAddress.getByName("8.8.8.8")) }, { http }),
    )
    private val font = "OTTO".toByteArray() + ByteArray(8)
    private fun payload(url: String): JsonObject = ApiJson.parseToJsonElement(
        """{"assets":[{"id":"body:0","type":"OTF","url":"$url"}],
        "theme":{"body":{"type":"fontFamily","faces":[{"assetId":"body:0","weight":400}],"allowFallback":true}}}""",
    ) as JsonObject

    @Test
    fun downloadsAnonymouslyCachesAndServesExactBytesOnPreviewOrigin(): Unit = runBlocking {
        var requests = 0
        val http = HttpClient(
            MockEngine { request ->
                requests++
                assertEquals("https://8.8.8.8/body.otf", request.url.toString())
                assertEquals("fonts.example", request.headers["Host"])
                assertNull(request.headers["Authorization"])
                assertNull(request.headers["Cookie"])
                respond(font)
            },
        ) { followRedirects = false }
        val assets = assets(http)
        assets.use {
            val prepared = it.prepare(payload("https://fonts.example/body.otf"))
            val url = prepared.objects("assets").single().text("url")!!
            assertTrue(url.startsWith(base.toString()))
            assertContentEquals(font, it.resource(url)!!.bytes)
            assertEquals("font/otf", it.resource(url)!!.mimeType)
            assertEquals("false", prepared.obj("theme").obj("body").text("allowFallback"))
            assertEquals(prepared, it.prepare(payload("https://fonts.example/body.otf")))
            assertEquals(1, requests)
            assertNull(it.resource("https://preview.example/other/font.otf"))
        }
        assertFailsWith<IllegalStateException> { assets.prepare(payload("https://fonts.example/body.otf")) }
    }

    @Test
    fun leavesSameOriginAndRelativeFontsInTheIsolatedBrowser() = runBlocking {
        assets(HttpClient(MockEngine { error("Unexpected external request") })).use { assets ->
            for (url in listOf("font.otf", "https://preview.example/fonts/body.otf")) {
                assertEquals(url, assets.prepare(payload(url)).objects("assets").single().text("url"))
            }
        }
    }

    @Test
    fun rejectsInsecureAndCredentialBearingExternalAddresses() = runBlocking {
        assets(HttpClient(MockEngine { error("Unsafe request must not be sent") })).use { assets ->
            for (url in listOf(
                "http://fonts.example/font.otf",
                "https://user:secret@fonts.example/font.otf",
                "file:/font.otf",
            )) {
                assertFailsWith<IllegalArgumentException> { assets.prepare(payload(url)) }
            }
        }
    }

    @Test
    fun rejectsRedirectsInsteadOfFollowingThem() = runBlocking {
        var requests = 0
        val http = HttpClient(
            MockEngine {
                requests++
                respond("", HttpStatusCode.Found, headersOf("Location", "https://other.example/font.otf"))
            },
        ) { followRedirects = false }
        assets(http).use {
            assertFailsWith<IllegalStateException> { it.prepare(payload("https://fonts.example/font.otf")) }
            assertEquals(1, requests)
        }
    }

    @Test
    fun rejectsOversizedAndNonFontResponses() = runBlocking {
        for ((bytes, headers) in listOf(
            "not a font, just an HTML response".toByteArray() to headersOf(),
            font to headersOf("Content-Length", "5000000"),
            ("OTTO".toByteArray() + ByteArray(4 * 1024 * 1024)) to headersOf(),
        )) {
            assets(HttpClient(MockEngine { respond(bytes, headers = headers) })).use {
                assertFailsWith<IllegalStateException> { it.prepare(payload("https://fonts.example/font.otf")) }
            }
        }
    }
}
