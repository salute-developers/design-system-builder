package com.dsbuilder.ds.components.data

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.runBlocking
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.S3Configuration
import java.net.InetSocketAddress
import java.net.URI
import java.net.URLDecoder
import java.time.Instant
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Адаптер хранилища против встроенного HTTP-сервера, который отвечает по REST-протоколу S3 для
 * `PutObject`, `ListObjectsV2` и `DeleteObjects`: проверяются ключи, заголовки и постраничное чтение.
 */
class S3PluginBuildStorageTest {
    private class Stored(val contentType: String?, val cacheControl: String?, val modified: Instant)

    private val objects = linkedMapOf<String, Stored>()
    private val deleteRequests = mutableListOf<List<String>>()
    private var pageSize = 1000
    private lateinit var server: HttpServer

    private fun storage(prefix: String) = S3PluginBuildStorage(
        S3Client.builder()
            .region(Region.US_EAST_1)
            .endpointOverride(URI.create("http://127.0.0.1:${server.address.port}"))
            .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create("key", "secret")))
            .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
            .httpClientBuilder(UrlConnectionHttpClient.builder())
            .build(),
        BUCKET,
        prefix,
    )

    @BeforeTest
    fun start() {
        server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/") { exchange -> handle(exchange) }
        server.start()
    }

    @AfterTest
    fun stop() = server.stop(0)

    private fun handle(exchange: HttpExchange) {
        val path = URLDecoder.decode(exchange.requestURI.rawPath, Charsets.UTF_8)
        val query = exchange.requestURI.rawQuery.orEmpty().split('&').filter(String::isNotEmpty).associate {
            URLDecoder.decode(it.substringBefore('='), Charsets.UTF_8) to
                URLDecoder.decode(it.substringAfter('=', ""), Charsets.UTF_8)
        }
        val body = exchange.requestBody.readBytes()
        val key = path.removePrefix("/$BUCKET").removePrefix("/")
        when {
            exchange.requestMethod == "PUT" && key.isNotEmpty() -> {
                objects[key] = Stored(
                    exchange.requestHeaders.getFirst("Content-Type"),
                    exchange.requestHeaders.getFirst("Cache-Control"),
                    Instant.parse("2026-10-01T00:00:00Z").plusSeconds(objects.size.toLong()),
                )
                reply(exchange, 200, "")
            }
            exchange.requestMethod == "GET" && "list-type" in query -> reply(exchange, 200, listing(query))
            exchange.requestMethod == "POST" && "delete" in query -> {
                val keys = Regex("<Key>([^<]*)</Key>").findAll(body.decodeToString()).map { it.groupValues[1] }.toList()
                deleteRequests += keys
                keys.forEach(objects::remove)
                val deleted = keys.joinToString("") { "<Deleted><Key>$it</Key></Deleted>" }
                reply(exchange, 200, "<DeleteResult>$deleted</DeleteResult>")
            }
            else -> reply(exchange, 404, "<Error><Code>NoSuchKey</Code></Error>")
        }
    }

    private fun listing(query: Map<String, String>): String {
        val prefix = query["prefix"].orEmpty()
        val matching = objects.keys.filter { it.startsWith(prefix) }.sorted()
        val start = query["continuation-token"]?.toInt() ?: 0
        val page = matching.drop(start).take(pageSize)
        val truncated = start + page.size < matching.size
        return buildString {
            append("<ListBucketResult><Name>$BUCKET</Name><Prefix>$prefix</Prefix><KeyCount>${page.size}</KeyCount>")
            append("<MaxKeys>$pageSize</MaxKeys><IsTruncated>$truncated</IsTruncated>")
            if (truncated) append("<NextContinuationToken>${start + page.size}</NextContinuationToken>")
            page.forEach { key ->
                append("<Contents><Key>$key</Key><LastModified>${objects.getValue(key).modified}</LastModified>")
                append("<Size>1</Size></Contents>")
            }
            append("</ListBucketResult>")
        }
    }

    private fun reply(exchange: HttpExchange, status: Int, body: String) {
        val bytes = body.toByteArray()
        exchange.responseHeaders.add("Content-Type", "application/xml")
        exchange.sendResponseHeaders(status, if (bytes.isEmpty()) -1 else bytes.size.toLong())
        if (bytes.isNotEmpty()) exchange.responseBody.use { it.write(bytes) }
        exchange.close()
    }

    @Test
    fun filesLandUnderThePrefixWithExplicitHeaders() = runBlocking {
        storage("design-system-builder/compose-preview").putFile(
            "0123456789ab",
            "composeResources/font/a.otf",
            byteArrayOf(1, 2, 3),
            "font/otf",
            "public, max-age=31536000, immutable",
        )

        val key = "design-system-builder/compose-preview/builds/0123456789ab/composeResources/font/a.otf"
        val stored = objects.getValue(key)
        assertEquals("font/otf", stored.contentType)
        assertEquals("public, max-age=31536000, immutable", stored.cacheControl)
    }

    @Test
    fun anEmptyPrefixPutsBuildsAtTheRootOfTheBucket() = runBlocking {
        storage("").putFile("0123456789ab", "app.wasm", byteArrayOf(1), "application/wasm", "immutable")

        assertEquals(listOf("builds/0123456789ab/app.wasm"), objects.keys.toList())
        assertEquals("application/wasm", objects.getValue("builds/0123456789ab/app.wasm").contentType)
    }

    @Test
    fun buildsAreListedByDirectoryWithTheirNewestModificationAcrossPages() = runBlocking {
        pageSize = 2
        val storage = storage("p")
        listOf("aaaaaaaaaaaa" to "index.html", "aaaaaaaaaaaa" to "app.js", "bbbbbbbbbbbb" to "index.html")
            .forEach { (build, file) -> storage.putFile(build, file, byteArrayOf(1), "text/plain", "x") }
        objects["p/other/readme.txt"] = Stored(null, null, Instant.now())

        val builds = storage.listBuilds().associate { it.buildId to it.lastModified }

        assertEquals(setOf("aaaaaaaaaaaa", "bbbbbbbbbbbb"), builds.keys)
        assertEquals(Instant.parse("2026-10-01T00:00:01Z"), builds.getValue("aaaaaaaaaaaa"))
        assertEquals(Instant.parse("2026-10-01T00:00:02Z"), builds.getValue("bbbbbbbbbbbb"))
    }

    @Test
    fun deletingABuildRemovesOnlyItsDirectory() = runBlocking {
        val storage = storage("p")
        storage.putFile("aaaaaaaaaaaa", "index.html", byteArrayOf(1), "text/html", "x")
        storage.putFile("aaaaaaaaaaaa", "composeResources/a.png", byteArrayOf(1), "image/png", "x")
        storage.putFile("bbbbbbbbbbbb", "index.html", byteArrayOf(1), "text/html", "x")

        storage.deleteBuild("aaaaaaaaaaaa")

        assertEquals(listOf("p/builds/bbbbbbbbbbbb/index.html"), objects.keys.toList())
        assertTrue(deleteRequests.single().all { it.startsWith("p/builds/aaaaaaaaaaaa/") })
    }

    private companion object {
        const val BUCKET = "compose-preview"
    }
}
