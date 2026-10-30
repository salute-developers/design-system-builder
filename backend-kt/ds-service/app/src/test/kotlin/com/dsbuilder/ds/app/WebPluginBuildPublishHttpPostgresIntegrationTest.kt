package com.dsbuilder.ds.app

import com.dsbuilder.ds.components.application.PluginArchiveLimits
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
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.sql.DriverManager
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Публикация web preview plugin (change publish-web-preview-plugin) на Postgres и MinIO: пробная и настоящая
 * публикация, импорт web-меты, выдача адреса web и независимость от билдов Compose. Билды обеих платформ лежат
 * в одном бакете под разными префиксами, как на стендах.
 */
class WebPluginBuildPublishHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `a web dry run validates everything and writes nothing`() = withService {
        val body = publish(PluginKind.WEB, webArchive(), dryRun = true).ok()
        assertEquals("published", body.string("outcome"))
        assertEquals("true", body.string("dryRun"))
        assertEquals("web", body.string("platform"))
        assertEquals("0.386.0", body.string("libraryVersion"))
        assertEquals(0, count("compose_preview_plugin_builds"))
        assertEquals(0, count("components"))
        assertTrue(objects(WEB_PREFIX).isEmpty())
    }

    @Test
    fun `a web publication stores the files in the web prefix imports the web meta and serves the address`() =
        withService {
            assertEquals(HttpStatusCode.NotFound, active(PluginKind.WEB).status)
            val body = publish(PluginKind.WEB, webArchive(commit = COMMIT_A), dryRun = false).ok()
            val buildId = COMMIT_A.take(12)
            assertEquals("published", body.string("outcome"))
            assertEquals(buildId, body.string("buildId"))
            assertEquals("web", body.string("platform"))
            assertEquals("0.386.0", body.string("libraryVersion"))
            assertEquals("$webBase/builds/$buildId/", body.string("pluginUrl"))

            assertEquals("web", query("SELECT platform::text FROM compose_preview_plugin_builds WHERE active"))
            assertEquals("0.386.0", query("SELECT library_version FROM compose_preview_plugin_builds"))
            assertEquals(1, count("components WHERE name = 'Button' AND platform = 'web'"))
            assertEquals(1, count("property_platform_params WHERE platform = 'web' AND name = 'view'"))
            assertEquals(
                setOf("index.html", "preview-plugin.json", "api-meta.json", "assets/index.js").map {
                    "$WEB_PREFIX/builds/$buildId/$it"
                }.toSet(),
                objects(WEB_PREFIX),
            )
            assertTrue(objects(COMPOSE_PREFIX).isEmpty())

            val served = active(PluginKind.WEB).ok()
            assertEquals(
                setOf(
                    "buildId",
                    "platform",
                    "libraryVersion",
                    "metaSha256",
                    "protocolVersion",
                    "pluginUrl",
                    "publishedAt",
                ),
                served.keys,
            )
            assertEquals(buildId, served.string("buildId"))
            assertEquals("web", served.string("platform"))
            assertEquals("0.386.0", served.string("libraryVersion"))
            assertTrue(served.string("pluginUrl").endsWith("/builds/$buildId/"))
            // the browser loads the plugin straight from the bucket without credentials
            val index = URI("${served.string("pluginUrl")}index.html").toURL().openConnection() as HttpURLConnection
            assertEquals(200, index.responseCode)
            assertEquals("text/html; charset=utf-8", index.contentType)
            // the Compose route serves no web build
            assertEquals(HttpStatusCode.NotFound, active(PluginKind.COMPOSE).status)
        }

    @Test
    fun `web publications and their cleanup leave the Compose build untouched`() = withService(keepBuilds = 0) {
        val compose = publish(PluginKind.COMPOSE, composeArchive(commit = COMMIT_A), dryRun = false).ok()
        val composeFiles = objects(COMPOSE_PREFIX)
        val composeActive = active(PluginKind.COMPOSE).ok()

        publish(PluginKind.WEB, webArchive(commit = COMMIT_B), dryRun = false).ok()
        publish(PluginKind.WEB, webArchive(commit = COMMIT_C), dryRun = false).ok()

        // web keeps only its active build
        assertEquals(setOf(COMMIT_C.take(12)), buildDirs(WEB_PREFIX))
        assertEquals(
            setOf("${COMMIT_A.take(12)}:compose:true", "${COMMIT_C.take(12)}:web:true"),
            rows("SELECT build_id || ':' || platform || ':' || active FROM compose_preview_plugin_builds"),
        )
        // the Compose build, its files and its response format are unchanged
        assertEquals(composeFiles, objects(COMPOSE_PREFIX))
        assertEquals(composeActive, active(PluginKind.COMPOSE).ok())
        assertEquals(
            setOf("buildId", "uikitComposeVersion", "metaSha256", "protocolVersion", "pluginUrl", "publishedAt"),
            composeActive.keys,
        )
        assertEquals("0.55.0", compose.string("uikitComposeVersion"))
        assertEquals(1, count("components WHERE name = 'Avatar' AND platform = 'compose'"))
    }

    @Test
    fun `meta and archives of another platform are refused before any write`() = withService {
        val composeMeta = publish(PluginKind.WEB, webArchive(), dryRun = false, meta = composeMeta())
        assertEquals(HttpStatusCode.BadRequest, composeMeta.status, composeMeta.bodyAsText())
        // invalid_body answers with the validation envelope, not with a manifest code
        assertTrue("code" !in json.parseToJsonElement(composeMeta.bodyAsText()).jsonObject)
        listOf(composeArchive(), webArchive(library = null)).forEach { archive ->
            val response = publish(PluginKind.WEB, archive, dryRun = false)
            assertEquals(HttpStatusCode.BadRequest, response.status, response.bodyAsText())
            assertEquals("PLUGIN_MANIFEST_INVALID", response.code())
        }
        // and the Compose route still refuses a web archive
        val webIntoCompose = publish(PluginKind.COMPOSE, webArchive(), dryRun = false)
        assertEquals("PLUGIN_MANIFEST_INVALID", webIntoCompose.code())
        assertEquals(0, count("compose_preview_plugin_builds"))
        assertEquals(0, count("components"))
        assertTrue(objects("").isEmpty())
    }

    @Test
    fun `a build id taken by Compose is a conflict`() = withService {
        publish(PluginKind.COMPOSE, composeArchive(commit = COMMIT_A), dryRun = false).ok()
        val response = publish(PluginKind.WEB, webArchive(commit = COMMIT_A), dryRun = false)
        assertEquals(HttpStatusCode.Conflict, response.status, response.bodyAsText())
        assertEquals("BUILD_PLATFORM_CONFLICT", response.code())
        assertEquals("compose", query("SELECT platform::text FROM compose_preview_plugin_builds"))
        assertTrue(objects(WEB_PREFIX).isEmpty())
    }

    @Test
    fun `only the publisher role or a system administrator publishes the web plugin`() = withService {
        assertEquals(HttpStatusCode.Forbidden, publish(PluginKind.WEB, webArchive(), actor = Actor.USER).status)
        assertEquals(HttpStatusCode.OK, publish(PluginKind.WEB, webArchive(), actor = Actor.ADMIN).status)
        assertEquals(HttpStatusCode.Forbidden, service.builder.client.get(PluginKind.WEB.active).status)
    }

    @Test
    fun `without the web storage the web publication is unavailable while Compose works`() =
        withService(webConfigured = false) {
            val web = publish(PluginKind.WEB, webArchive(commit = COMMIT_B), dryRun = false)
            assertEquals(HttpStatusCode.ServiceUnavailable, web.status, web.bodyAsText())
            assertEquals(HttpStatusCode.NotFound, active(PluginKind.WEB).status)
            assertEquals(
                "published",
                publish(PluginKind.COMPOSE, composeArchive(), dryRun = false).ok().string("outcome"),
            )
            assertEquals(HttpStatusCode.OK, active(PluginKind.COMPOSE).status)
            assertEquals(0, count("components WHERE platform = 'web'"))
        }

    // ── helpers ───────────────────────────────────────────────────────────────────────────

    private enum class PluginKind(val publish: String, val active: String) {
        COMPOSE("/api/ds/admin/compose-preview/plugin-builds", "/api/ds/compose-preview/plugin"),
        WEB("/api/ds/admin/web-preview/plugin-builds", "/api/ds/web-preview/plugin"),
    }

    private enum class Actor { PUBLISHER, ADMIN, USER }

    private suspend fun publish(
        kind: PluginKind,
        bytes: ByteArray,
        dryRun: Boolean = true,
        actor: Actor = Actor.PUBLISHER,
        meta: String = if (kind == PluginKind.WEB) webMeta() else composeMeta(),
    ): HttpResponse = service.builder.client.post("${kind.publish}?dryRun=$dryRun") {
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
                    append("meta", meta)
                },
            ),
        )
    }

    private suspend fun active(kind: PluginKind): HttpResponse =
        service.builder.client.get(kind.active) { actor(Actor.USER) }

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

    private fun webMeta() =
        """{"platform":"web","meta":{"source":"api-meta.json"},"dryRun":true,"components":""" +
            """[{"name":"Button","states":[],"properties":""" +
            """[{"name":"view","type":"color","platformNames":["view"]}]}]}"""

    private fun composeMeta() =
        """{"platform":"compose","meta":{"source":"api-meta.json"},"dryRun":true,"components":""" +
            """[{"name":"Avatar","states":["hovered"],"properties":""" +
            """[{"name":"shape","type":"shape","platformNames":["shape"]}]}]}"""

    private fun webArchive(commit: String = COMMIT_A, library: String? = "0.386.0"): ByteArray {
        val meta = """{"components":[{"name":"Button"}]}"""
        val manifest = """{"schemaVersion":1,"id":"sdds.web.preview","platform":"web","protocolVersion":1,""" +
            """"entrypoint":"index.html","version":"${commit.take(12)}","commit":"$commit",""" +
            (library?.let { """"plasmaNewHopeVersion":"$it",""" } ?: "") +
            """"apiMetaSha256":"${sha256Hex(meta.toByteArray())}"}"""
        return zip(
            mapOf(
                "index.html" to "<html/>",
                "preview-plugin.json" to manifest,
                "api-meta.json" to meta,
                "assets/index.js" to "console.log('$commit')",
            ),
        )
    }

    private fun composeArchive(commit: String = COMMIT_A): ByteArray {
        val meta = """[{"componentName":"Avatar"}]"""
        val manifest = """{"schemaVersion":1,"id":"sdds.compose.preview","platform":"compose","protocolVersion":1,""" +
            """"entrypoint":"index.html","version":"${commit.take(12)}","commit":"$commit",""" +
            """"uikitComposeVersion":"0.55.0","apiMetaSha256":"${sha256Hex(meta.toByteArray())}"}"""
        return zip(
            mapOf(
                "index.html" to "<html/>",
                "preview-plugin.json" to manifest,
                "api-meta.json" to meta,
                "app.wasm" to "wasm-$commit",
            ),
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

    private suspend fun HttpResponse.code(): String =
        json.parseToJsonElement(bodyAsText()).jsonObject.string("code")

    private fun JsonObject.string(name: String) = getValue(name).jsonPrimitive.content

    private fun objects(prefix: String): Set<String> = MinioTestServer.keys(bucket, prefix)

    private fun buildDirs(prefix: String): Set<String> =
        objects("$prefix/builds/").map { it.removePrefix("$prefix/builds/").substringBefore('/') }.toSet()

    // ── harness ───────────────────────────────────────────────────────────────────────────

    private class Service(val postgres: IsolatedPostgresDatabase, val builder: ApplicationTestBuilder)

    private lateinit var service: Service
    private lateinit var bucket: String
    private val webBase: String
        get() = "${MinioTestServer.endpoint}/$bucket/$WEB_PREFIX"

    private fun withService(
        keepBuilds: Int = 5,
        webConfigured: Boolean = true,
        body: suspend WebPluginBuildPublishHttpPostgresIntegrationTest.() -> Unit,
    ) {
        // A missing Docker, MinIO image or Postgres fails the test here instead of skipping it.
        bucket = "plugins-${UUID.randomUUID()}"
        MinioTestServer.createPublicBucket(bucket)
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres, keepBuilds, webConfigured)) }
                service = Service(postgres, this)
                kotlinx.coroutines.runBlocking { body() }
            }
        }
    }

    private fun configuration(postgres: IsolatedPostgresDatabase, keepBuilds: Int, webConfigured: Boolean) =
        DsServiceConfiguration(
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
                endpoint = MinioTestServer.endpoint,
                region = MinioTestServer.REGION,
                bucket = bucket,
                accessKey = MinioTestServer.ACCESS_KEY,
                secretKey = MinioTestServer.SECRET_KEY,
                pathStyle = true,
                prefix = COMPOSE_PREFIX,
                publicBaseUrl = "${MinioTestServer.endpoint}/$bucket/$COMPOSE_PREFIX",
                keepBuilds = keepBuilds,
                limits = PluginArchiveLimits(),
                web = PreviewPluginStorageLocation(
                    bucket = bucket,
                    prefix = WEB_PREFIX,
                    publicBaseUrl = webBase.takeIf { webConfigured },
                ),
            ),
        )

    private fun count(tableAndWhere: String): Int = query("SELECT count(*) FROM $tableAndWhere").toInt()

    private fun query(sql: String): String = rows(sql).single()

    private fun rows(sql: String): Set<String> = DriverManager.getConnection(
        service.postgres.jdbcUrl,
        service.postgres.username,
        service.postgres.password,
    ).use {
        it.createStatement().use { statement ->
            statement.executeQuery(sql).use { rows -> buildSet { while (rows.next()) add(rows.getString(1)) } }
        }
    }

    private companion object {
        const val COMPOSE_PREFIX = "design-system-builder/compose-preview"
        const val WEB_PREFIX = "design-system-builder/web-preview"
        const val COMMIT_A = "aaaaaaaaaaaa1111111111111111111111111111"
        const val COMMIT_B = "bbbbbbbbbbbb2222222222222222222222222222"
        const val COMMIT_C = "cccccccccccc3333333333333333333333333333"
    }
}
