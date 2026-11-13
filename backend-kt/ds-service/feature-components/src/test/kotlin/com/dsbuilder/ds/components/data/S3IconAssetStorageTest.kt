package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.domain.IconAsset
import com.dsbuilder.ds.components.domain.IconCatalogLoadId
import com.dsbuilder.ds.components.domain.IconSize
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
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/**
 * Адаптер хранилища против встроенного HTTP-сервера, который отвечает по REST-протоколу S3 для
 * `PutObject`, `ListObjectsV2` и `DeleteObjects` для хранилища иконок: ключи, заголовки, постраничное чтение.
 */
class S3IconAssetStorageTest {
    private class Stored(val contentType: String?, val cacheControl: String?, val modified: Instant)

    private val objects = linkedMapOf<String, Stored>()
    private val deleteRequests = mutableListOf<List<String>>()
    private var pageSize = 1000
    private lateinit var server: HttpServer

    private fun storage(prefix: String) = S3IconAssetStorage(
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

    private fun asset(name: String, size: IconSize = IconSize.S24) = IconAsset(name, size, "<svg/>")

    @Test
    fun filesLandUnderTheIconsPrefixWithExplicitHeaders() = runBlocking {
        storage(
            "design-system-builder/compose-preview/icons",
        ).put(IconCatalogLoadId("0123456789ab"), asset("AddOutline"))

        val key = "design-system-builder/compose-preview/icons/0123456789ab/24/AddOutline.svg"
        val stored = objects.getValue(key)
        assertEquals("image/svg+xml", stored.contentType)
        assertEquals("public, max-age=31536000, immutable", stored.cacheControl)
    }

    @Test
    fun theIconsPrefixCanSitNextToThePlugins() = runBlocking {
        storage("static/icons").put(IconCatalogLoadId("0123456789ab"), asset("AddFill", IconSize.S16))

        assertEquals(listOf("static/icons/0123456789ab/16/AddFill.svg"), objects.keys.toList())
    }

    @Test
    fun aBlankPrefixIsRefusedBecauseCleanupWouldTouchTheWholeBucket() {
        assertFailsWith<IllegalArgumentException> { storage("") }
        assertFailsWith<IllegalArgumentException> { storage("/") }
    }

    @Test
    fun onlyDirectoriesNamedLikeLoadsAreListedAndDeleted() = runBlocking {
        val storage = storage("static")
        storage.put(IconCatalogLoadId("aaaaaaaaaaaa"), asset("AddOutline"))
        objects["static/compose-preview/builds/x/index.html"] = Stored(null, null, Instant.now())
        objects["static/web-preview/index.html"] = Stored(null, null, Instant.now())

        assertEquals(listOf("aaaaaaaaaaaa"), storage.listLoads().map { it.loadId })
        assertFailsWith<IllegalArgumentException> { storage.deleteLoad("compose-preview") }
        assertTrue(objects.containsKey("static/compose-preview/builds/x/index.html"))
    }

    @Test
    fun loadsAreListedAndCheckedWithoutTouchingPluginBuilds() = runBlocking {
        pageSize = 2
        val storage = storage("p/icons")
        val a = IconCatalogLoadId("aaaaaaaaaaaa")
        val b = IconCatalogLoadId("bbbbbbbbbbbb")
        listOf(a to "AddOutline", a to "AddFill", b to "AddOutline").forEach { (load, name) ->
            storage.put(load, asset(name))
        }
        objects["p/builds/cccccccccccc/index.html"] = Stored(null, null, Instant.now())

        assertEquals(setOf("aaaaaaaaaaaa", "bbbbbbbbbbbb"), storage.listLoads().map { it.loadId }.toSet())
    }

    @Test
    fun deletingALoadRemovesOnlyItsDirectory() = runBlocking {
        val storage = storage("p/icons")
        storage.put(IconCatalogLoadId("aaaaaaaaaaaa"), asset("AddOutline"))
        storage.put(IconCatalogLoadId("aaaaaaaaaaaa"), asset("AddOutline", IconSize.S16))
        storage.put(IconCatalogLoadId("bbbbbbbbbbbb"), asset("AddOutline"))
        objects["p/builds/aaaaaaaaaaaa/index.html"] = Stored(null, null, Instant.now())

        storage.deleteLoad("aaaaaaaaaaaa")

        assertEquals(setOf("p/icons/bbbbbbbbbbbb/24/AddOutline.svg", "p/builds/aaaaaaaaaaaa/index.html"), objects.keys)
        assertTrue(deleteRequests.single().all { it.startsWith("p/icons/aaaaaaaaaaaa/") })
    }

    private companion object {
        const val BUCKET = "compose-preview"
    }
}
