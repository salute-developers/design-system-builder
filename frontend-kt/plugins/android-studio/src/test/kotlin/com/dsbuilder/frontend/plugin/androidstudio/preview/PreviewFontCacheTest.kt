package com.dsbuilder.frontend.plugin.androidstudio.preview

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpHeaders
import io.ktor.http.headersOf
import kotlinx.coroutines.runBlocking
import java.net.InetAddress
import java.nio.file.Files
import kotlin.io.path.createTempDirectory
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull

class PreviewFontCacheTest {
    private val font = "OTTO".toByteArray() + ByteArray(8)
    private val publicImmutable = "public, max-age=3600, immutable"
    private val url = "https://fonts.example/body.otf?signature=private-query"

    @Test
    fun survivesSessionRestartAndStoresNeitherUrlNorQuery() = runBlocking {
        val directory = createTempDirectory("font-cache-test")
        try {
            PreviewFontCache(directory).store(url, "OTF", font, publicImmutable, null)
            assertContentEquals(font, PreviewFontCache(directory).read(url, "OTF"))
            val file = Files.list(directory).use { it.toList().single() }
            assertFalse(file.fileName.toString().contains("private-query"))
            assertFalse(String(Files.readAllBytes(file), Charsets.ISO_8859_1).contains("private-query"))
            assertNull(PreviewFontCache(directory).read("https://other.example/body.otf", "OTF"))
        } finally {
            directory.toFile().deleteRecursively()
        }
    }

    @Test
    fun honorsRemainingFreshnessAndRejectsCorruptedBytes() = runBlocking {
        val directory = createTempDirectory("font-cache-test")
        var now = 1000L
        val cache = PreviewFontCache(directory, clock = { now })
        try {
            cache.store(url, "OTF", font, publicImmutable, "3599")
            now += 1000
            assertNull(cache.read(url, "OTF"))
            cache.store(url, "OTF", font, publicImmutable, null)
            val file = Files.list(directory).use { it.toList().single() }
            val bytes = Files.readAllBytes(file)
            bytes[bytes.lastIndex] = 1
            Files.write(file, bytes)
            assertNull(cache.read(url, "OTF"))
        } finally {
            directory.toFile().deleteRecursively()
        }
    }

    @Test
    fun cachesOnlyExplicitlyPublicImmutableResponsesAndCapsLifetime() {
        for (header in listOf(
            null,
            "public, max-age=3600",
            "immutable, max-age=3600",
            "$publicImmutable, private = \"x\"",
            "$publicImmutable, no-store",
            "$publicImmutable, no-cache",
        )) {
            assertNull(immutableFontLifetime(header, null))
        }
        assertNull(immutableFontLifetime(publicImmutable, "3600"))
        assertNull(immutableFontLifetime(publicImmutable, "invalid"))
        assertEquals(7 * 24 * 60 * 60 * 1000L, immutableFontLifetime("public, immutable, max-age=31536000", null))
    }

    @Test
    fun boundsDiskEntriesAndBytesAndRetainsRecentlyUsedFonts() = runBlocking {
        val directory = createTempDirectory("font-cache-test")
        var now = 1000L
        val cache = PreviewFontCache(directory, clock = { now }, maxBytes = 120, maxEntries = 2)
        try {
            cache.store("https://fonts.example/a", "OTF", font, publicImmutable, null)
            now++
            cache.store("https://fonts.example/b", "OTF", font, publicImmutable, null)
            now++
            cache.read("https://fonts.example/a", "OTF")
            now++
            cache.store("https://fonts.example/c", "OTF", font, publicImmutable, null)
            assertNull(cache.read("https://fonts.example/b", "OTF"))
            assertContentEquals(font, cache.read("https://fonts.example/a", "OTF"))
            assertContentEquals(font, cache.read("https://fonts.example/c", "OTF"))
            assertEquals(2, Files.list(directory).use { it.count() }.toInt())
            assertEquals(120L, Files.list(directory).use { stream -> stream.toList().sumOf { Files.size(it) } })
        } finally {
            directory.toFile().deleteRecursively()
        }
    }

    @Test
    fun cacheIoFailureIsOptional() = runBlocking {
        val directory = createTempDirectory("font-cache-test")
        try {
            val file = directory.resolve("not-a-directory")
            Files.writeString(file, "occupied")
            val cache = PreviewFontCache(file)
            cache.store(url, "OTF", font, publicImmutable, null)
            assertNull(cache.read(url, "OTF"))
        } finally {
            directory.toFile().deleteRecursively()
        }
    }

    @Test
    fun warmDownloaderUsesVerifiedDiskBytesWithoutDnsOrNetwork() = runBlocking {
        val directory = createTempDirectory("font-cache-test")
        try {
            val http = HttpClient(MockEngine { respond(font, headers = headersOf("Cache-Control", publicImmutable)) })
            PreviewFontDownloader(
                { listOf(InetAddress.getByName("8.8.8.8")) },
                { http },
                PreviewFontCache(directory),
            ).use { assertContentEquals(font, it.download(url, "OTF")) }
            PreviewFontDownloader(
                { error("Warm font must not resolve DNS") },
                { error("Warm font must not create HTTP client") },
                PreviewFontCache(directory),
            ).use { assertContentEquals(font, it.download(url, "OTF")) }
        } finally {
            directory.toFile().deleteRecursively()
        }
    }

    @Test
    fun varyingRepresentationsAreNotPersisted() = runBlocking {
        val directory = createTempDirectory("font-cache-test")
        try {
            val cache = PreviewFontCache(directory)
            for (vary in listOf("*", "Accept-Language", "Accept-Encoding")) {
                cache.store(url, "OTF", font, publicImmutable, null, vary)
                assertNull(cache.read(url, "OTF"))
            }
        } finally {
            directory.toFile().deleteRecursively()
        }
    }

    @Test
    fun downloaderRejectsProhibitionsAndAmbiguityInRepeatedHeaders() = runBlocking {
        val cases = listOf("private", "no-store", "no-cache", "max-age=1").map { prohibition ->
            headersOf(HttpHeaders.CacheControl to listOf(publicImmutable, prohibition))
        } + listOf(
            headersOf(HttpHeaders.CacheControl to listOf(publicImmutable), HttpHeaders.Vary to listOf("", "*")),
            headersOf(HttpHeaders.CacheControl to listOf(publicImmutable), HttpHeaders.Age to listOf("0", "0")),
        )
        for (headers in cases) {
            val directory = createTempDirectory("font-cache-test")
            try {
                val cache = PreviewFontCache(directory)
                val http = HttpClient(MockEngine { respond(font, headers = headers) })
                PreviewFontDownloader({ listOf(InetAddress.getByName("8.8.8.8")) }, { http }, cache).use {
                    assertContentEquals(font, it.download(url, "OTF"))
                }
                assertNull(cache.read(url, "OTF"))
            } finally {
                directory.toFile().deleteRecursively()
            }
        }
    }
}
