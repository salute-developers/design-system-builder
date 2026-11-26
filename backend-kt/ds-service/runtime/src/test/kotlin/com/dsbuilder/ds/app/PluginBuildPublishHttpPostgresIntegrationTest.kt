@file:Suppress("ktlint:standard:max-line-length")

package com.dsbuilder.ds.app

import com.dsbuilder.ds.components.application.PluginArchiveLimits
import com.dsbuilder.ds.components.application.PluginBuildStorage
import com.dsbuilder.ds.components.application.StoredPluginBuild
import com.dsbuilder.ds.components.application.sha256Hex
import com.dsbuilder.ds.components.domain.PreviewPluginPlatform
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.forms.MultiPartFormDataContent
import io.ktor.client.request.forms.formData
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.ByteArrayOutputStream
import java.sql.DriverManager
import java.time.Instant
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream
import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Публикация Compose preview plugin (change host-compose-preview-plugin): доступ, проверки архива, запись файлов
 * и меты, идемпотентность, активный билд, очистка и выдача адреса.
 */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class PluginBuildPublishHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `only the publisher role or a system administrator is admitted and the role is checked before the body`() =
        withService {
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
    fun `publisher can replace a preview for registered Core but cannot register a release`() = withService {
        val original = archive(channel = "dev")
        assertEquals(HttpStatusCode.Forbidden, publish(original, Actor.PUBLISHER).status)
        assertEquals(HttpStatusCode.Forbidden, publish(original, Actor.PUBLISHER, dryRun = false).status)
        assertEquals(0, count("core_releases WHERE provenance = 'imported'"))
        assertEquals(0, count("compose_preview_plugin_builds"))
        assertEquals(0, storage.puts)

        service.builder.client.post("/api/admin/component-config/import-api-meta") {
            actor(Actor.ADMIN)
            contentType(ContentType.Application.Json)
            setBody(releaseMetaBody(metaBody().replace("\"dryRun\":true", "\"dryRun\":false"), original))
        }.ok()
        assertEquals("published", publish(original, Actor.PUBLISHER, dryRun = false).ok().string("outcome"))
        val changed = archive(channel = "dev", extra = mapOf("changed.txt" to "new preview"))
        assertEquals("replaced", publish(changed, Actor.PUBLISHER, dryRun = false).ok().string("outcome"))
        val putsBeforeRejected = storage.puts
        val otherLibrary = archive(commit = COMMIT_B, channel = "dev", libraryId = "other-compose")
        assertEquals(HttpStatusCode.Forbidden, publish(otherLibrary, Actor.PUBLISHER).status)
        assertEquals(HttpStatusCode.Forbidden, publish(otherLibrary, Actor.PUBLISHER, dryRun = false).status)
        assertEquals(putsBeforeRejected, storage.puts)
        assertEquals(1, count("core_releases WHERE provenance = 'imported'"))
    }

    @Test
    fun `an unconfigured storage answers 503 and writes nothing`() = withService(storage = null) {
        assertEquals(HttpStatusCode.ServiceUnavailable, publish(archive(), Actor.ADMIN, dryRun = false).status)
        assertEquals(0, count("compose_preview_plugin_builds"))
        assertEquals(0, count("components"))
        // The state of an environment without the plugin storage: no address, so the client shows no Compose preview.
        assertEquals(HttpStatusCode.NotFound, active(Actor.USER).status)
        assertEquals(HttpStatusCode.NotFound, active(Actor.ADMIN).status)
    }

    @Test
    fun `a dry run validates everything and writes nothing`() = withService {
        val response = publish(archive(), Actor.ADMIN, dryRun = true)
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
        val body = publish(first, Actor.ADMIN, dryRun = false).ok()
        assertEquals("published", body.string("outcome"))
        assertEquals(COMMIT_A.take(12), body.string("buildId"))
        assertEquals("0.55.0", body.string("uikitComposeVersion"))
        assertTrue(body.string("pluginUrl").endsWith("/builds/${COMMIT_A.take(12)}/"))
        assertEquals(1, count("compose_preview_plugin_builds WHERE active"))
        assertEquals(1, count("components WHERE name = 'Avatar' AND platform = 'compose'"))
        assertEquals("integration-admin", query("SELECT published_by FROM compose_preview_plugin_builds"))

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
        publish(a, Actor.ADMIN, dryRun = false).ok()
        val putsAfterFirst = storage.puts
        assertEquals("unchanged", publish(a, Actor.ADMIN, dryRun = false).ok().string("outcome"))
        assertEquals(putsAfterFirst, storage.puts)

        assertEquals("published", publish(b, Actor.ADMIN, dryRun = false).ok().string("outcome"))
        assertEquals(COMMIT_B.take(12), query("SELECT build_id FROM compose_preview_plugin_builds WHERE active"))
        assertEquals(1, count("compose_preview_plugin_builds WHERE active"))

        assertEquals("activated", publish(a, Actor.ADMIN, dryRun = false).ok().string("outcome"))
        assertEquals(COMMIT_A.take(12), query("SELECT build_id FROM compose_preview_plugin_builds WHERE active"))
    }

    @Test
    fun `the same build with another archive is rejected and nothing changes`() = withService {
        publish(archive(commit = COMMIT_A), Actor.ADMIN, dryRun = false).ok()
        val changed = archive(commit = COMMIT_A, extra = mapOf("extra.txt" to "x"))
        val response = publish(changed, Actor.ADMIN, dryRun = false)
        assertEquals(HttpStatusCode.Conflict, response.status, response.bodyAsText())
        assertEquals("BUILD_CONTENT_CHANGED", json.parseToJsonElement(response.bodyAsText()).jsonObject.string("code"))
        assertEquals(1, count("compose_preview_plugin_builds"))
        assertTrue("${COMMIT_A.take(12)}/extra.txt" !in storage.files)
    }

    @Test
    fun `an archive above the meta limit but within the archive limit is accepted`() = withService {
        val blob = Random(7).nextBytes(20 * 1024 * 1024)
        val big = withBlob(archive(commit = COMMIT_A), blob)
        assertTrue(big.size > 16 * 1024 * 1024, "the fixture must exceed the former 16 MiB parser limit")

        assertEquals("published", publish(big, Actor.ADMIN, dryRun = false).ok().string("outcome"))
        assertEquals(1, count("compose_preview_plugin_builds WHERE active"))
        assertTrue("${COMMIT_A.take(12)}/blob.bin" in storage.files)
    }

    @Test
    fun `concurrent publications of one build with different archives keep the accepted files`() = withService {
        val plain = archive(commit = COMMIT_A)
        val changed = archive(commit = COMMIT_A, extra = mapOf("extra.txt" to "x"))

        val responses = coroutineScope {
            listOf(plain, changed).map { async { publish(it, Actor.ADMIN, dryRun = false) } }.awaitAll()
        }
        val statuses = responses.map { it.status }
        val details = responses.map { "${it.status}: ${it.bodyAsText()}" }.joinToString()

        assertEquals(1, statuses.count { it == HttpStatusCode.OK }, details)
        assertEquals(1, statuses.count { it == HttpStatusCode.Conflict }, details)
        assertEquals(1, count("compose_preview_plugin_builds"))
        val recordedHash = query("SELECT zip_sha256 FROM compose_preview_plugin_builds")
        val winner = if (recordedHash == sha256Hex(changed)) changed else plain
        assertEquals(recordedHash, sha256Hex(winner))
        assertEquals(winner === changed, "${COMMIT_A.take(12)}/extra.txt" in storage.files)
    }

    @Test
    fun `the old builds cleanup keeps the build a concurrent rollback activates`() = withService(keepBuilds = 1) {
        val a = archive(commit = COMMIT_A)
        publish(a, Actor.ADMIN, dryRun = false).ok()
        publish(archive(commit = COMMIT_B), Actor.ADMIN, dryRun = false).ok()
        publish(archive(commit = COMMIT_C), Actor.ADMIN, dryRun = false).ok()

        // A is the oldest and is already beyond keepBuilds; a rollback to it and a new publication race.
        val statuses = coroutineScope {
            listOf(a, archive(commit = COMMIT_D)).map { async { publish(it, Actor.ADMIN, dryRun = false).status } }
                .awaitAll()
        }

        assertTrue(statuses.all { it == HttpStatusCode.OK }, statuses.toString())
        assertEquals(1, count("compose_preview_plugin_builds WHERE active"))
        val activeId = query("SELECT build_id FROM compose_preview_plugin_builds WHERE active")
        assertTrue(storage.files.keys.any { it.startsWith("$activeId/") }, "the active build must keep its files")
        assertEquals(buildIds(), storage.files.keys.map { it.substringBefore('/') }.toSet())
    }

    @Test
    fun `an invalid archive or manifest is refused before any write`() = withService {
        val bad = listOf(
            "PLUGIN_ARCHIVE_UNSAFE_PATH" to archive(extra = mapOf("../escape.txt" to "x")),
            "PLUGIN_FILE_MISSING" to zip(mapOf("index.html" to "<html/>")),
            "PLUGIN_META_SHA256_MISMATCH" to archive(metaSha = "0".repeat(64)),
            "PLUGIN_MANIFEST_INVALID" to archive(version = "not-a-build-id"),
            "PLUGIN_ENTRYPOINT_MISSING" to archive(entrypoint = "missing.html"),
            "PLUGIN_ARCHIVE_INVALID" to "not a zip".toByteArray(),
        )
        bad.forEach { (code, bytes) ->
            val response = publish(bytes, Actor.ADMIN, dryRun = false)
            assertEquals(HttpStatusCode.BadRequest, response.status, "$code: ${response.bodyAsText()}")
            assertEquals(code, json.parseToJsonElement(response.bodyAsText()).jsonObject.string("code"))
        }
        assertEquals(0, count("compose_preview_plugin_builds"))
        assertEquals(0, count("components"))
        assertTrue(storage.files.isEmpty())
    }

    @Test
    fun `a storage failure leaves the active build and the meta untouched`() = withService {
        publish(archive(commit = COMMIT_A), Actor.ADMIN, dryRun = false).ok()
        storage.failOnPut = true
        val response =
            publish(archive(commit = COMMIT_B, uikit = "0.56.0", avatar = "Badge"), Actor.ADMIN, dryRun = false)
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
            publish(archive(commit = it), Actor.ADMIN, dryRun = false).ok()
        }
        // active (C) plus one most recent inactive build (B); A is removed
        assertEquals(setOf(COMMIT_B.take(12), COMMIT_C.take(12)), buildIds())
        assertTrue(storage.files.keys.none { it.startsWith(COMMIT_A.take(12)) })
        assertTrue(storage.files.keys.none { it.startsWith("orphan0000001") })
        assertTrue(storage.files.keys.any { it.startsWith("fresh0000001") })
    }

    @Test
    fun `the active build address is public and ignores the design system version`() = withService {
        assertEquals(HttpStatusCode.NotFound, active(Actor.USER).status)
        publish(archive(commit = COMMIT_A, uikit = "0.56.1"), Actor.ADMIN, dryRun = false).ok()
        val body = active(Actor.USER).ok()
        assertEquals(COMMIT_A.take(12), body.string("buildId"))
        assertEquals("0.56.1", body.string("uikitComposeVersion"))
        assertEquals(1, body.getValue("protocolVersion").jsonPrimitive.content.toInt())
        assertTrue(body.string("pluginUrl").startsWith(PUBLIC_BASE))
        assertTrue(body.string("pluginUrl").endsWith("/"))
        val withVersion = service.builder.client.get("$ACTIVE?versionId=${UUID.randomUUID()}") { actor(Actor.USER) }
        assertEquals(COMMIT_A.take(12), withVersion.ok().string("buildId"))
        assertEquals(body, service.builder.client.get(ACTIVE).ok())
    }

    @Test
    fun `a publication does not write design system journals or versions`() = withService {
        val before = count("design_system_versions")
        publish(archive(), Actor.ADMIN, dryRun = false).ok()
        assertEquals(before, count("design_system_versions"))
        assertEquals(0, count("information_schema.tables WHERE table_name = 'design_system_changes'"))
    }

    @Test
    fun `the publisher role opens nothing except the publication`() = withService {
        val import = service.builder.client.post("/api/admin/component-config/import-api-meta") {
            actor(Actor.PUBLISHER)
            contentType(ContentType.Application.Json)
            setBody(metaBody())
        }
        assertEquals(HttpStatusCode.Forbidden, import.status)
        assertEquals(0, count("components"))
        val publisherOnProjectRoute = service.builder.client.get("/api/design-systems/catalog/components") {
            header("X-Actor-Type", "user")
            header("X-User-Id", "compose-publisher")
            header("X-Project-Id", "project-a")
            header("X-System-Admin", "false")
            header("X-Compose-Preview-Publisher", "true")
        }
        assertEquals(HttpStatusCode.Forbidden, publisherOnProjectRoute.status)
        val withProjectRole = service.builder.client.get("/api/design-systems/catalog/components") {
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

    @Test
    fun `versions pin preview and a late build fills only the empty slot of its Core`() = withService(keepBuilds = 1) {
        suspend fun postJson(path: String, body: String) = service.builder.client.post(path) {
            actor(Actor.ADMIN)
            header("Idempotency-Key", java.util.UUID.randomUUID().toString())
            contentType(ContentType.Application.Json)
            setBody(body)
        }
        suspend fun createPublished(name: String, coreVersion: String): Pair<String, String> {
            val created = postJson("/api/design-systems", """{"name":"$name","projectName":"$name"}""")
            assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
            val system = json.parseToJsonElement(created.bodyAsText()).jsonObject.string("id")
            val changed = service.builder.client.patch("/api/design-systems/$system") {
                actor(Actor.ADMIN)
                header("Idempotency-Key", java.util.UUID.randomUUID().toString())
                contentType(ContentType.Application.Json)
                setBody("""{"name":"$name updated"}""")
            }
            assertEquals(HttpStatusCode.OK, changed.status, changed.bodyAsText())
            val response = service.builder.client.get("/api/design-systems/$system") { actor(Actor.ADMIN) }
            val draft = response.ok()
            val release = query("SELECT id FROM core_releases WHERE version = '$coreVersion'")
            val selection = service.builder.client.put("/api/design-systems/$system/core-settings/compose") {
                actor(Actor.ADMIN)
                contentType(ContentType.Application.Json)
                setBody(
                    """{"channel":"stable","releaseId":"$release","expectedDraftId":${draft.getValue(
                        "draftId",
                    )},"expectedCoreSelectionRevision":0}""",
                )
            }
            assertEquals(HttpStatusCode.OK, selection.status, selection.bodyAsText())
            val published = postJson(
                "/api/design-systems/$system/versions",
                """{"draftId":${draft.getValue(
                    "draftId",
                )},"draftRevision":${draft.getValue("draftRevision")},"version":"1.0.0"}""",
            )
            assertEquals(HttpStatusCode.Created, published.status, published.bodyAsText())
            return system to json.parseToJsonElement(published.bodyAsText()).jsonObject.string("id")
        }
        suspend fun selected(system: String, version: String? = null) = service.builder.client.get(
            "/api/design-systems/$system/preview/compose" + (version?.let { "?versionId=$it" } ?: ""),
        ) { actor(Actor.ADMIN) }

        publish(archive(), Actor.ADMIN, dryRun = false).ok()
        val (systemA, versionA) = createPublished("preview-a", "0.55.0")
        assertEquals(COMMIT_A.take(12), selected(systemA, versionA).ok().string("buildId"))
        val b = archive(COMMIT_B, uikit = "0.56.0")
        val meta = json.parseToJsonElement(releaseMetaBody(metaBody(), b)).jsonObject
        val imported = postJson(
            "/api/admin/component-config/import-api-meta",
            JsonObject(meta + ("dryRun" to kotlinx.serialization.json.JsonPrimitive(false))).toString(),
        )
        assertEquals(HttpStatusCode.OK, imported.status, imported.bodyAsText())
        val (systemB, versionB) = createPublished("preview-b", "0.56.0")
        assertEquals(HttpStatusCode.NotFound, selected(systemB, versionB).status)
        assertEquals(COMMIT_A.take(12), selected(systemA).ok().string("buildId"))
        assertEquals(COMMIT_A.take(12), selected(systemA, versionA).ok().string("buildId"))
        publish(b, Actor.ADMIN, dryRun = false).ok()
        assertEquals(COMMIT_B.take(12), selected(systemB, versionB).ok().string("buildId"))
        publish(archive(COMMIT_C, uikit = "0.56.0"), Actor.ADMIN, dryRun = false).ok()
        assertEquals(COMMIT_B.take(12), selected(systemB, versionB).ok().string("buildId"))
        assertEquals(COMMIT_C.take(12), selected(systemB).ok().string("buildId"))
        assertEquals(COMMIT_A.take(12), selected(systemA, versionA).ok().string("buildId"))
        assertTrue(COMMIT_A.take(12) in buildIds(), "cleanup must retain the pinned old Core build")
        assertTrue(storage.files.keys.any { it.startsWith(COMMIT_A.take(12) + "/") })
    }

    @Test
    fun `cleanup rechecks a draft pin committed while it waits for the Core barrier`() = withService(keepBuilds = 1) {
        publish(archive(COMMIT_A, uikit = "1.0.0"), Actor.ADMIN, dryRun = false).ok()
        publish(archive(COMMIT_B, uikit = "2.0.0"), Actor.ADMIN, dryRun = false).ok()
        val release = query("SELECT id FROM core_releases WHERE version = '1.0.0'")
        val system = UUID.randomUUID()
        val draft = UUID.randomUUID()
        DriverManager.getConnection(
            service.postgres.jdbcUrl,
            service.postgres.username,
            service.postgres.password,
        ).use { selection ->
            selection.createStatement().use {
                it.execute(
                    "INSERT INTO design_systems(id,project_name,project_id) VALUES ('$system','cleanup-race','project')",
                )
                it.execute(
                    "INSERT INTO design_system_versions(id,design_system_id,status,sequence_number,revision,published_at) VALUES ('${UUID.randomUUID()}','$system','baseline',0,0,NULL)",
                )
                it.execute(
                    "INSERT INTO design_system_versions(id,design_system_id,status,sequence_number,revision,published_at) VALUES ('$draft','$system','draft',1,0,NULL)",
                )
            }
            selection.autoCommit = false
            selection.createStatement().use {
                it.execute("SELECT pg_advisory_xact_lock_shared(hashtextextended('$release',684314))")
                it.execute(
                    "INSERT INTO design_system_version_core_releases(version_id,platform,release_id) VALUES ('$draft','compose','$release')",
                )
            }
            coroutineScope {
                val cleanup = async { publish(archive(COMMIT_C, uikit = "3.0.0"), Actor.ADMIN, dryRun = false) }
                withTimeout(10_000) {
                    while (query("SELECT count(*) FROM pg_stat_activity WHERE wait_event = 'advisory' AND query LIKE '%pg_advisory_xact_lock(%'").toInt() == 0) delay(
                        20,
                    )
                }
                assertTrue(!cleanup.isCompleted)
                selection.commit()
                cleanup.await().ok()
            }
        }
        assertTrue(COMMIT_A.take(12) in buildIds())
        assertTrue(storage.files.keys.any { it.startsWith(COMMIT_A.take(12) + "/") })
    }

    @Test
    fun `legacy preview multipart is rejected before inspecting either old or new ZIP`() = withService {
        for (bytes in listOf("old archive".toByteArray(), archive())) {
            val response = service.builder.client.post(PATH) {
                actor(Actor.ADMIN)
                setBody(
                    MultiPartFormDataContent(
                        formData {
                            append(
                                "plugin",
                                bytes,
                                Headers.build { append(HttpHeaders.ContentDisposition, "filename=plugin.zip") },
                            )
                            append("meta", metaBody())
                        },
                    ),
                )
            }
            assertEquals(HttpStatusCode.BadRequest, response.status, response.bodyAsText())
            assertTrue(response.bodyAsText().contains("CORE_RELEASE_METADATA_REQUIRED"))
            assertTrue(response.bodyAsText().contains("CLI"))
        }
        assertEquals(0, count("compose_preview_plugin_builds"))
        assertEquals(0, count("components"))
        assertEquals(0, storage.puts)
    }

    // ── helpers ───────────────────────────────────────────────────────────────────────────

    private enum class Actor { PUBLISHER, ADMIN, USER }

    @Test
    fun `ordinary dev upload switches the complete URL and removes the old generation`() = withService {
        val a = archive(channel = "dev")
        val old = publish(a, Actor.ADMIN, dryRun = false).ok()
        val changed = archive(channel = "dev", extra = mapOf("new.txt" to "new"))
        val before = storage.puts
        val preview = publish(changed, Actor.ADMIN).ok()
        assertEquals("replaced", preview.string("outcome"))
        assertEquals(before, storage.puts)
        assertEquals(old.string("pluginUrl"), active(Actor.USER).ok().string("pluginUrl"))
        val replaced = publish(changed, Actor.ADMIN, dryRun = false).ok()
        assertEquals("replaced", replaced.string("outcome"))
        assertEquals(old.string("buildId"), replaced.string("buildId"))
        assertTrue(old.string("pluginUrl") != replaced.string("pluginUrl"))
        val key = replaced.string("pluginUrl").trimEnd('/').substringAfterLast('/')
        assertTrue(storage.files.keys.all { it.startsWith("$key/") })
        assertTrue("$key/new.txt" in storage.files)
        assertEquals(setOf(COMMIT_A.take(12)), buildIds())
        val after = storage.puts
        assertEquals("unchanged", publish(changed, Actor.ADMIN, dryRun = false).ok().string("outcome"))
        assertEquals(after, storage.puts)
        val third = archive(channel = "dev", extra = mapOf("third.txt" to "third"))
        val next = publish(third, Actor.ADMIN, dryRun = false).ok()
        val nextKey = next.string("pluginUrl").trimEnd('/').substringAfterLast('/')
        assertTrue(storage.files.keys.all { it.startsWith("$nextKey/") })
        assertTrue(storage.files.keys.none { it.endsWith("new.txt") })
    }

    @Test
    fun `replacement rejects stable and changed Core before writing files`() = withService {
        publish(archive(), Actor.ADMIN, dryRun = false).ok()
        val count = storage.puts
        val rejected = publish(archive(extra = mapOf("changed" to "x")), Actor.ADMIN, dryRun = false)
        assertEquals(HttpStatusCode.Conflict, rejected.status)
        assertEquals(count, storage.puts)
    }

    @Test
    fun `dev replacement cannot alter registered Core coordinates or meta`() = withService {
        publish(archive(channel = "dev"), Actor.ADMIN, dryRun = false).ok()
        val before = storage.files.keys.toSet()
        for (zip in listOf(archive(channel = "dev", uikit = "0.56.0"), archive(channel = "dev", avatar = "Changed"))) {
            val result = publish(zip, Actor.ADMIN, dryRun = false)
            assertEquals(HttpStatusCode.Conflict, result.status, result.bodyAsText())
        }
        assertEquals(before, storage.files.keys)
    }

    @Test
    fun `partial storage failure and DB failure preserve the previous complete generation`() = withService {
        val old = publish(archive(channel = "dev"), Actor.ADMIN, dryRun = false).ok()
        val files = storage.files.keys.toSet()
        val changed = archive(channel = "dev", extra = mapOf("new.txt" to "new"))
        storage.failAfter = storage.puts + 1
        assertEquals(
            HttpStatusCode.ServiceUnavailable,
            publish(changed, Actor.ADMIN, dryRun = false).status,
        )
        assertEquals(files, storage.files.keys)
        assertEquals(old.string("pluginUrl"), active(Actor.USER).ok().string("pluginUrl"))
        storage.failAfter = null
        sql(
            "CREATE FUNCTION fail_preview_replace() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END; $$",
        )
        sql(
            "CREATE TRIGGER fail_preview_replace BEFORE UPDATE OF storage_key ON compose_preview_plugin_builds FOR EACH ROW EXECUTE FUNCTION fail_preview_replace()",
        )
        val result = publish(changed, Actor.ADMIN, dryRun = false)
        assertTrue(result.status.value >= 400, result.bodyAsText())
        assertEquals(files, storage.files.keys)
        assertEquals(old.string("pluginUrl"), active(Actor.USER).ok().string("pluginUrl"))
    }

    @Test
    fun `draft selection allows replacement but a concurrent historical pin forbids it`() = withService {
        publish(archive(channel = "dev"), Actor.ADMIN, dryRun = false).ok()
        val release = query("SELECT id FROM core_releases WHERE version = '0.55.0'")
        val system = java.util.UUID.randomUUID()
        val boundary = java.util.UUID.randomUUID()
        val buildId = COMMIT_A.take(12)
        sql("INSERT INTO design_systems(id,project_name,project_id) VALUES ('$system','replace-test','project-a')")
        sql(
            "INSERT INTO design_system_versions(id,design_system_id,status,sequence_number,revision,published_at) VALUES ('${java.util.UUID.randomUUID()}','$system','baseline',0,0,NULL)",
        )
        sql(
            "INSERT INTO design_system_versions(id,design_system_id,status,sequence_number,revision,published_at) VALUES ('$boundary','$system','draft',1,0,NULL)",
        )
        sql(
            "INSERT INTO design_system_version_core_releases(version_id,platform,release_id) VALUES ('$boundary','compose','$release')",
        )
        val changed = archive(channel = "dev", extra = mapOf("first.txt" to "first"))
        val replaced = publish(changed, Actor.ADMIN, dryRun = false).ok()
        val files = storage.files.keys.toSet()
        DriverManager.getConnection(
            service.postgres.jdbcUrl,
            service.postgres.username,
            service.postgres.password,
        ).use { pin ->
            pin.autoCommit = false
            pin.createStatement().use {
                it.execute(
                    "SELECT pg_advisory_xact_lock_shared(hashtextextended('$release', 684314))",
                )
            }
            coroutineScope {
                val replacing = async {
                    publish(
                        archive(channel = "dev", extra = mapOf("second.txt" to "second")),
                        Actor.ADMIN,
                        dryRun = false,
                    )
                }
                withTimeout(10_000) {
                    while (query("SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND NOT granted").toInt() == 0) delay(
                        10,
                    )
                }
                pin.createStatement().use {
                    it.execute(
                        "INSERT INTO design_system_version_preview_builds(version_id,platform,release_id,build_id) VALUES ('$boundary','compose','$release','$buildId')",
                    )
                    it.execute(
                        "UPDATE design_system_versions SET status='published', version='1.0.0', published_at=now() WHERE id='$boundary'",
                    )
                }
                pin.commit()
                val refused = replacing.await()
                assertEquals(HttpStatusCode.Conflict, refused.status)
                assertTrue(refused.bodyAsText().contains("PREVIEW_BUILD_PINNED"))
            }
        }
        assertEquals(files, storage.files.keys)
        assertEquals(replaced.string("pluginUrl"), active(Actor.USER).ok().string("pluginUrl"))
        val beforePinnedUpload = storage.puts
        val alreadyPinned = publish(
            archive(channel = "dev", extra = mapOf("third.txt" to "third")),
            Actor.ADMIN,
            dryRun = false,
        )
        assertEquals(HttpStatusCode.Conflict, alreadyPinned.status)
        assertTrue(alreadyPinned.bodyAsText().contains("PREVIEW_BUILD_PINNED"))
        assertEquals(beforePinnedUpload, storage.puts)
    }

    @Test
    fun `new Core version and build ID can be uploaded without changing base commit`() = withService {
        publish(
            archive(uikit = "1.0.0-dev.1", version = "111111111111", channel = "dev"),
            Actor.ADMIN,
            dryRun = false,
        ).ok()
        publish(
            archive(uikit = "1.0.0-dev.2", version = "222222222222", channel = "dev", avatar = "Changed"),
            Actor.ADMIN,
            dryRun = false,
        ).ok()
        assertEquals(setOf("111111111111", "222222222222"), buildIds())
        assertEquals("222222222222", active(Actor.USER).ok().string("buildId"))
    }

    private fun sql(value: String) {
        DriverManager.getConnection(service.postgres.jdbcUrl, service.postgres.username, service.postgres.password)
            .use { connection -> connection.createStatement().use { it.execute(value) } }
    }

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
                        append("meta", releaseMetaBody(metaBody(), bytes))
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
        channel: String = "stable",
        libraryId: String = "fixture-compose",
    ): ByteArray {
        val meta = """[{"componentName":"$avatar"}]"""
        val manifest = """{"schemaVersion":1,"id":"sdds.compose.preview","platform":"compose","protocolVersion":1,""" +
            """"entrypoint":"$entrypoint","version":"$version","commit":"$commit","uikitComposeVersion":"$uikit",""" +
            """"channel":"$channel","coreRelease":{"libraryId":"$libraryId",""" +
            """"platform":"compose","version":"$uikit"},""" +
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

    private fun withBlob(archive: ByteArray, blob: ByteArray): ByteArray {
        val out = ByteArrayOutputStream()
        ZipOutputStream(out).use { zip ->
            ZipInputStream(archive.inputStream()).use { input ->
                generateSequence { input.nextEntry }.forEach { entry ->
                    zip.putNextEntry(ZipEntry(entry.name))
                    zip.write(input.readBytes())
                    zip.closeEntry()
                }
            }
            zip.putNextEntry(ZipEntry("blob.bin"))
            zip.write(blob)
            zip.closeEntry()
        }
        return out.toByteArray()
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
        var failAfter: Int? = null

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
            check(!failOnPut && (failAfter == null || puts < requireNotNull(failAfter))) { "storage failure" }
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
            integrationTestApplication {
                application {
                    module(
                        configuration(postgres, keepBuilds),
                        storage?.let { mapOf(PreviewPluginPlatform.COMPOSE to it) }.orEmpty(),
                    )
                }
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
        const val PATH = "/api/admin/compose-preview/plugin-builds"
        const val ACTIVE = "/api/design-systems/catalog/compose-preview/plugin"
        const val PUBLIC_BASE = "https://plugins.example.test/compose-preview"
        const val COMMIT_A = "aaaaaaaaaaaa1111111111111111111111111111"
        const val COMMIT_B = "bbbbbbbbbbbb2222222222222222222222222222"
        const val COMMIT_C = "cccccccccccc3333333333333333333333333333"
        const val COMMIT_D = "dddddddddddd4444444444444444444444444444"
    }
}
