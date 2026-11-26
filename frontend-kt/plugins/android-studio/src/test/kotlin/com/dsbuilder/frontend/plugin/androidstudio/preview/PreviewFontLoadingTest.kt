package com.dsbuilder.frontend.plugin.androidstudio.preview

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import java.net.InetAddress
import java.net.URI
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class PreviewFontLoadingTest {
    private val font = "OTTO".toByteArray() + ByteArray(8)

    private fun assets(http: HttpClient) = PreviewFontAssets(
        URI("https://preview.example/build/.ide-fonts/session/"),
        PreviewFontDownloader({ listOf(InetAddress.getByName("8.8.8.8")) }, { http }),
    )

    private fun payload(indices: List<Int>) = JsonObject(
        mapOf(
            "assets" to JsonArray(
                indices.mapIndexed { index, value ->
                    jsonObject(
                        "id" to string("font:$index"), "type" to string("OTF"),
                        "url" to string("https://fonts.example/font$value.otf"),
                    )
                },
            ),
        ),
    )

    @Test
    fun downloadsFourFontsConcurrentlyDeduplicatesAndReusesWarmCache() = runBlocking {
        val release = CompletableDeferred<Unit>()
        val fourStarted = CompletableDeferred<Unit>()
        val active = AtomicInteger()
        val peak = AtomicInteger()
        val requests = AtomicInteger()
        val http = HttpClient(
            MockEngine {
                requests.incrementAndGet()
                val count = active.incrementAndGet()
                peak.updateAndGet { maxOf(it, count) }
                if (count == 4) fourStarted.complete(Unit)
                try {
                    release.await()
                    respond(font)
                } finally {
                    active.decrementAndGet()
                }
            },
        )
        assets(http).use { assets ->
            val source = payload((0..9).toList() + 0)
            val preparing = async { assets.prepare(source) }
            withTimeout(2_000) { fourStarted.await() }
            assertEquals(4, requests.get())
            val foreground = async { assets.prepare(source) }
            release.complete(Unit)
            val prepared = preparing.await()
            assertEquals(prepared, foreground.await())
            assertEquals(4, peak.get())
            assertEquals(10, requests.get())
            assertEquals(
                prepared.objects("assets").first().text("url"),
                prepared.objects("assets").last().text("url"),
            )
            assertEquals(prepared, assets.prepare(source))
            assertEquals(10, requests.get())
        }
    }

    @Test
    fun cancellingFirstLoadAllowsRetryWithoutLeavingPreparationLocked() = runBlocking {
        val started = CompletableDeferred<Unit>()
        val release = CompletableDeferred<Unit>()
        val http = HttpClient(
            MockEngine {
                started.complete(Unit)
                release.await()
                respond(font)
            },
        )
        assets(http).use { assets ->
            val source = payload((0..7).toList())
            val first = launch { assets.prepare(source) }
            withTimeout(2_000) { started.await() }
            first.cancelAndJoin()
            release.complete(Unit)
            val prepared = withTimeout(2_000) { assets.prepare(source) }
            assertEquals(8, prepared.objects("assets").size)
        }
    }

    @Test
    fun parallelBatchCannotOverrunSessionFileLimit(): Unit = runBlocking {
        assets(HttpClient(MockEngine { respond(font) })).use { assets ->
            assets.prepare(payload(listOf(0)))
            assertFailsWith<IllegalStateException> { assets.prepare(payload((1..128).toList())) }
        }
    }
}
