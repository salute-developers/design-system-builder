package com.dsbuilder.ds.app

import com.dsbuilder.ds.components.application.PluginArchiveLimits
import com.dsbuilder.ds.components.application.PluginBuildStorage
import com.dsbuilder.ds.components.application.StoredPluginBuild
import com.dsbuilder.ds.components.application.sha256Hex
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.forms.MultiPartFormDataContent
import io.ktor.client.request.forms.formData
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.ByteArrayOutputStream
import java.sql.DriverManager
import java.time.Instant
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Публикация Compose preview plugin (change host-compose-preview-plugin): доступ, проверки архива, запись файлов
 * и меты, идемпотентность, активный билд, очистка и выдача адреса.
 */
class PluginBuildPublishHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `only the publisher role or a system administrator is admitted and the role is checked before the body`() =
        withService {
            assertEquals(HttpStatusCode.OK, publish(archive(), Actor.PUBLISHER).status)
            assertEquals(HttpStatusCode.OK, publish(archive(), Actor.ADMIN).status)
            assertEquals(HttpStatusCode.Forbidden, publish(archive(), Actor.USER).status)
            // a refused caller never gets a 400 for a malformed body
            val notMultipart = service.builder.client.post(PATH) {
                actor(Actor.USER)
                contentType(ContentType.Application.Json)
                setBody("{}")
            }
            assertEquals(HttpStatusCode.Forbidden, notMultipart.status)
            val noHeaders = service.builder.client.post(PATH) { setBody("{}") }
            assertEquals(HttpStatusCode.Forbidden, noHeaders.status)
            assertEquals(0, count("compose_preview_plugin_builds"))
        }

    @Test
    fun `an unconfigured storage answers 503 and writes nothing`() = withService(storage = null) {
        assertEquals(HttpStatusCode.ServiceUnavailable, publish(archive(), Actor.PUBLISHER, dryRun = false).status)
        assertEquals(0, count("compose_preview_plugin_builds"))
        assertEquals(0, count("components"))
    }

    @Test
    fun `a dry run validates everything and writes nothing`() = withService {
        val response = publish(archive(), Actor.PUBLISHER, dryRun = true)
        val body = response.ok()
        assertEquals("published", body.string("outcome"))
        assertEquals(true, body.getValue("dryRun").jsonPrimitive.content.toBoolean())
        assertEquals(0, count("compose_preview_plugin_builds"))
        assertEquals(0, count("components"))
        assertTrue(storage.files.isEmpty())
    }

    @Test
    fun `a publication stores files with explicit headers imports the meta and activates the build`() = withService {
        val first = archive(commit = COMMIT_A, uikit = "0.55.0")
        val body = publish(first, Actor.PUBLISHER, dryRun = false).ok()
        assertEquals("published", body.string("outcome"))
        assertEquals(COMMIT_A.take(12), body.string("buildId"))
        assertEquals("0.55.0", body.string("uikitComposeVersion"))
        assertTrue(body.string("pluginUrl").endsWith("/builds/${COMMIT_A.take(12)}/"))
        assertEquals(1, count("compose_preview_plugin_builds WHERE active"))
        assertEquals(1, count("components WHERE name = 'Avatar' AND platform = 'compose'"))
        assertEquals("compose-publisher", query("SELECT published_by FROM compose_preview_plugin_builds"))

        val wasm = storage.files.getValue("${COMMIT_A.take(12)}/app.wasm")
        assertEquals("application/wasm", wasm.contentType)
        assertEquals("public, max-age=31536000, immutable", wasm.cacheControl)
        assertEquals(
            "text/html; charset=utf-8",
            storage.files.getValue("${COMMIT_A.take(12)}/index.html").contentType,
        )
        val buildDir = COMMIT_A.take(12)
        assertTrue(storage.files.keys.containsAll(listOf("$buildDir/preview-plugin.json", "$buildDir/api-meta.json")))
    }

    @Test
    fun `a repeated archive is unchanged and the previous build can be activated again`() = withService {
        val a = archive(commit = COMMIT_A)
        val b = archive(commit = COMMIT_B)
        publish(a, Actor.PUBLISHER, dryRun = false).ok()
        val putsAfterFirst = storage.puts
        assertEquals("unchanged", publish(a, Actor.PUBLISHER, dryRun = false).ok().string("outcome"))
        assertEquals(putsAfterFirst, storage.puts)

        assertEquals("published", publish(b, Actor.PUBLISHER, dryRun = false).ok().string("outcome"))
        assertEquals(COMMIT_B.take(12), query("SELECT build_id FROM compose_preview_plugin_builds WHERE active"))
        assertEquals(1, count("compose_preview_plugin_builds WHERE active"))

        assertEquals("activated", publish(a, Actor.PUBLISHER, dryRun = false).ok().string("outcome"))
        assertEquals(COMMIT_A.take(12), query("SELECT build_id FROM compose_preview_plugin_builds WHERE active"))
    }

    @Test
    fun `the same build with another archive is rejected and nothing changes`() = withService {
        publish(archive(commit = COMMIT_A), Actor.PUBLISHER, dryRun = false).ok()
        val changed = archive(commit = COMMIT_A, extra = mapOf("extra.txt" to "x"))
        val response = publish(changed, Actor.PUBLISHER, dryRun = false)
        assertEquals(HttpStatusCode.Conflict, response.status, response.bodyAsText())
        assertEquals("BUILD_CONTENT_CHANGED", json.parseToJsonElement(response.bodyAsText()).jsonObject.string("code"))
        assertEquals(1, count("compose_preview_plugin_builds"))
        assertTrue("${COMMIT_A.take(12)}/extra.txt" !in storage.files)
    }

    @Test
    fun `an invalid archive or manifest is refused before any write`() = withService {
        val bad = listOf(
            "PLUGIN_ARCHIVE_UNSAFE_PATH" to archive(extra = mapOf("../escape.txt" to "x")),
            "PLUGIN_FILE_MISSING" to zip(mapOf("index.html" to "<html/>")),
            "PLUGIN_META_SHA256_MISMATCH" to archive(metaSha = "0".repeat(64)),
            "PLUGIN_VERSION_COMMIT_MISMATCH" to archive(version = "000000000000"),
            "PLUGIN_ENTRYPOINT_MISSING" to archive(entrypoint = "missing.html"),
            "PLUGIN_ARCHIVE_INVALID" to "not a zip".toByteArray(),
        )
        bad.forEach { (code, bytes) ->
            val response = publish(bytes, Actor.PUBLISHER, dryRun = false)
            assertEquals(HttpStatusCode.BadRequest, response.status, "$code: ${response.bodyAsText()}")
            assertEquals(code, json.parseToJsonElement(response.bodyAsText()).jsonObject.string("code"))
        }
        assertEquals(0, count("compose_preview_plugin_builds"))
        assertEquals(0, count("components"))
        assertTrue(storage.files.isEmpty())
    }

    @Test
    fun `a storage failure leaves the active build and the meta untouched`() = withService {
        publish(archive(commit = COMMIT_A), Actor.PUBLISHER, dryRun = false).ok()
        storage.failOnPut = true
        val response = publish(archive(commit = COMMIT_B, avatar = "Badge"), Actor.PUBLISHER, dryRun = false)
        assertEquals(HttpStatusCode.ServiceUnavailable, response.status)
        assertEquals(COMMIT_A.take(12), query("SELECT build_id FROM compose_preview_plugin_builds WHERE active"))
        assertEquals(1, count("compose_preview_plugin_builds"))
        assertEquals(0, count("components WHERE name = 'Badge'"))
    }

    @Test
    fun `old builds and orphan directories are removed while the active build stays`() = withService(keepBuilds = 1) {
        storage.preload("orphan0000001", Instant.now().minusSeconds(3 * 24 * 3600))
        storage.preload("fresh0000001", Instant.now())
        listOf(COMMIT_A, COMMIT_B, COMMIT_C).forEach {
            publish(archive(commit = it), Actor.PUBLISHER, dryRun = false).ok()
        }
        // active (C) plus one most recent inactive build (B); A is removed
        assertEquals(setOf(COMMIT_B.take(12), COMMIT_C.take(12)), buildIds())
        assertTrue(storage.files.keys.none { it.startsWith(COMMIT_A.take(12)) })
        assertTrue(storage.files.keys.none { it.startsWith("orphan0000001") })
        assertTrue(storage.files.keys.any { it.startsWith("fresh0000001") })
    }

    @Test
    fun `the active build address is served to project members and ignores the design system version`() = withService {
        assertEquals(HttpStatusCode.NotFound, active(Actor.USER).status)
        publish(archive(commit = COMMIT_A, uikit = "0.56.1"), Actor.PUBLISHER, dryRun = false).ok()
        val body = active(Actor.USER).ok()
        assertEquals(COMMIT_A.take(12), body.string("buildId"))
        assertEquals("0.56.1", body.string("uikitComposeVersion"))
        assertEquals(1, body.getValue("protocolVersion").jsonPrimitive.content.toInt())
        assertTrue(body.string("pluginUrl").startsWith(PUBLIC_BASE))
        assertTrue(body.string("pluginUrl").endsWith("/"))
        val withVersion = service.builder.client.get("$ACTIVE?versionId=${UUID.randomUUID()}") { actor(Actor.USER) }
        assertEquals(COMMIT_A.take(12), withVersion.ok().string("buildId"))
        assertEquals(HttpStatusCode.Forbidden, service.builder.client.get(ACTIVE).status)
    }

    @Test
    fun `a publication does not write design system journals or versions`() = withService {
        val before = count("design_system_versions")
        publish(archive(), Actor.PUBLISHER, dryRun = false).ok()
        assertEquals(before, count("design_system_versions"))
        assertEquals(0, count("information_schema.tables WHERE table_name = 'design_system_changes'"))
    }

    @Test
    fun `the publisher role opens nothing except the publication`() = withService {
        val import = service.builder.client.post("/api/ds/admin/component-config/import-api-meta") {
            actor(Actor.PUBLISHER)
            contentType(ContentType.Application.Json)
            setBody(metaBody())
        }
        assertEquals(HttpStatusCode.Forbidden, import.status)
        assertEquals(0, count("components"))
        val publisherOnProjectRoute = service.builder.client.get("/api/ds/components") {
            header("X-Actor-Type", "user")
            header("X-User-Id", "compose-publisher")
            header("X-Project-Id", "project-a")
            header("X-System-Admin", "false")
            header("X-Compose-Preview-Publisher", "true")
        }
        assertEquals(HttpStatusCode.Forbidden, publisherOnProjectRoute.status)
        val withProjectRole = service.builder.client.get("/api/ds/components") {
            header("X-Actor-Type", "user")
            header("X-User-Id", "compose-publisher")
            header("X-Project-Id", "project-a")
            header("X-Project-Role", "owner")
            header("X-System-Admin", "false")
            header("X-Compose-Preview-Publisher", "true")
        }
        // a project role together with the publisher flag is still an ordinary project member
        assertEquals(HttpStatusCode.OK, withProjectRole.status)
    }

    // ── helpers ───────────────────────────────────────────────────────────────────────────

    private enum class Actor { PUBLISHER, ADMIN, USER }

    private suspend fun publish(bytes: ByteArray, actor: Actor, dryRun: Boolean = true): HttpResponse =
        service.builder.client.post("$PATH?dryRun=$dryRun") {
            actor(actor)
            setBody(
                MultiPartFormDataContent(
                    formData {
                        append(
                            "plugin",
                            bytes,
                            Headers.build {
                                append(HttpHeaders.ContentType, "application/zip")
                                append(HttpHeaders.ContentDisposition, "filename=\"plugin.zip\"")
                            },
                        )
                        append("meta", metaBody())
                    },
                ),
            )
        }

    private suspend fun active(actor: Actor): HttpResponse = service.builder.client.get(ACTIVE) { actor(actor) }

    private fun HttpRequestBuilder.actor(actor: Actor) {
        header("X-Actor-Type", "user")
        when (actor) {
            Actor.PUBLISHER -> {
                header("X-User-Id", "compose-publisher")
                header("X-Project-Id", "global")
                header("X-System-Admin", "false")
                header("X-Compose-Preview-Publisher", "true")
            }
            Actor.ADMIN -> {
                header("X-User-Id", "integration-admin")
                header("X-Project-Id", "global")
                header("X-System-Admin", "true")
            }
            Actor.USER -> {
                header("X-User-Id", "integration-user")
                header("X-Project-Id", "project-a")
                header("X-Project-Role", "owner")
                header("X-System-Admin", "false")
            }
        }
    }

    private fun metaBody(component: String = "Avatar") =
        """{"platform":"compose","meta":{"source":"api-meta.json"},"dryRun":true,"components":""" +
            """[{"name":"$component","states":["hovered"],"properties":""" +
            """[{"name":"shape","type":"shape","platformNames":["shape"]}]}]}"""

    private fun archive(
        commit: String = COMMIT_A,
        uikit: String = "0.55.0",
        version: String = commit.take(12),
        metaSha: String? = null,
        entrypoint: String = "index.html",
        extra: Map<String, String> = emptyMap(),
        avatar: String = "Avatar",
    ): ByteArray {
        val meta = """[{"componentName":"$avatar"}]"""
        val manifest = """{"schemaVersion":1,"id":"sdds.compose.preview","platform":"compose","protocolVersion":1,""" +
            """"entrypoint":"$entrypoint","version":"$version","commit":"$commit","uikitComposeVersion":"$uikit",""" +
            """"apiMetaSha256":"${metaSha ?: sha256Hex(meta.toByteArray())}","components":["$avatar"]}"""
        return zip(
            mapOf(
                "index.html" to "<html/>",
                "preview-plugin.json" to manifest,
                "api-meta.json" to meta,
                "app.wasm" to "wasm-$commit",
                "app.js" to "js-$commit",
            ) + extra,
        )
    }

    private fun zip(files: Map<String, String>): ByteArray {
        val out = ByteArrayOutputStream()
        ZipOutputStream(out).use { zip ->
            files.forEach { (path, content) ->
                zip.putNextEntry(ZipEntry(path))
                zip.write(content.toByteArray())
                zip.closeEntry()
            }
        }
        return out.toByteArray()
    }

    private suspend fun HttpResponse.ok(): JsonObject {
        assertEquals(HttpStatusCode.OK, status, bodyAsText())
        return json.parseToJsonElement(bodyAsText()).jsonObject
    }

    private fun JsonObject.string(name: String) = getValue(name).jsonPrimitive.content

    private fun buildIds(): Set<String> = DriverManager.getConnection(
        service.postgres.jdbcUrl,
        service.postgres.username,
        service.postgres.password,
    ).use { connection ->
        connection.createStatement().use { statement ->
            statement.executeQuery("SELECT build_id FROM compose_preview_plugin_builds").use { rows ->
                buildSet { while (rows.next()) add(rows.getString(1)) }
            }
        }
    }

    // ── harness ───────────────────────────────────────────────────────────────────────────

    private class Service(val postgres: IsolatedPostgresDatabase, val builder: ApplicationTestBuilder)

    private class InMemoryStorage(override val configured: Boolean = true) : PluginBuildStorage {
        class Stored(val contentType: String, val cacheControl: String, val modified: Instant)

        val files = linkedMapOf<String, Stored>()
        var failOnPut = false
        var puts = 0

        fun preload(buildId: String, modified: Instant) {
            files["$buildId/index.html"] = Stored("text/html", "x", modified)
        }

        override suspend fun putFile(
            buildId: String,
            path: String,
            bytes: ByteArray,
            contentType: String,
            cacheControl: String,
        ) {
            check(!failOnPut) { "storage failure" }
            puts++
            files["$buildId/$path"] = Stored(contentType, cacheControl, Instant.now())
        }

        override suspend fun listBuilds(): List<StoredPluginBuild> =
            files.entries.groupBy({ it.key.substringBefore('/') }, { it.value.modified })
                .map { (id, times) -> StoredPluginBuild(id, times.max()) }

        override suspend fun deleteBuild(buildId: String) {
            files.keys.removeAll { it.startsWith("$buildId/") }
        }
    }

    private lateinit var service: Service
    private lateinit var storage: InMemoryStorage

    private fun withService(
        storage: InMemoryStorage? = InMemoryStorage(),
        keepBuilds: Int = 5,
        body: suspend PluginBuildPublishHttpPostgresIntegrationTest.() -> Unit,
    ) {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres, keepBuilds), storage) }
                service = Service(postgres, this)
                this@PluginBuildPublishHttpPostgresIntegrationTest.storage = storage ?: InMemoryStorage(false)
                kotlinx.coroutines.runBlocking { body() }
            }
        }
    }

    private fun configuration(postgres: IsolatedPostgresDatabase, keepBuilds: Int) = DsServiceConfiguration(
        port = 0,
        databaseUrl = postgres.jdbcUrl,
        databaseUser = postgres.username,
        databasePassword = postgres.password,
        databasePoolSize = 4,
        databaseConnectionTimeoutMs = 5_000,
        authorizationPolicyPath = null,
        runFlyway = true,
        adoptExistingSchema = false,
        expectedSchemaFingerprint = null,
        composePreviewPlugin = ComposePreviewPluginConfiguration(
            publicBaseUrl = PUBLIC_BASE,
            keepBuilds = keepBuilds,
            limits = PluginArchiveLimits(),
        ),
    )

    private fun count(tableAndWhere: String): Int = query("SELECT count(*) FROM $tableAndWhere").toInt()

    private fun query(sql: String): String = DriverManager.getConnection(
        service.postgres.jdbcUrl,
        service.postgres.username,
        service.postgres.password,
    ).use {
        it.createStatement().use { statement ->
            statement.executeQuery(sql).use { rows ->
                rows.next()
                rows.getString(1)
            }
        }
    }

    private companion object {
        const val PATH = "/api/ds/admin/compose-preview/plugin-builds"
        const val ACTIVE = "/api/ds/compose-preview/plugin"
        const val PUBLIC_BASE = "https://plugins.example.test/compose-preview"
        const val COMMIT_A = "aaaaaaaaaaaa1111111111111111111111111111"
        const val COMMIT_B = "bbbbbbbbbbbb2222222222222222222222222222"
        const val COMMIT_C = "cccccccccccc3333333333333333333333333333"
    }
}
