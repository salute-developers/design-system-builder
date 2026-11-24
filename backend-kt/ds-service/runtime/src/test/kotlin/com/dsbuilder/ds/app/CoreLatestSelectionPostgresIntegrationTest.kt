@file:Suppress("ktlint:standard:max-line-length")

package com.dsbuilder.ds.app

import com.dsbuilder.testing.IntegrationTest
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.experimental.categories.Category
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Проверяет реальный импорт latest, ревизии, закрепление истории и наследование следующего черновика. */
@Category(IntegrationTest::class)
class CoreLatestSelectionPostgresIntegrationTest {
    @Test
    fun `latest follows only new releases in its channel and history stays pinned`() {
        IsolatedPostgresDatabase.create().use { db ->
            testApplication {
                application {
                    module(
                        DsServiceConfiguration(
                            port = 0, databaseUrl = db.jdbcUrl, databaseUser = db.username, databasePassword = db.password,
                            databasePoolSize = 4, databaseConnectionTimeoutMs = 5_000, authorizationPolicyPath = null,
                            runFlyway = true, adoptExistingSchema = false, expectedSchemaFingerprint = null,
                        ),
                    )
                }
                val system = UUID.randomUUID()
                val pinned = UUID.randomUUID()
                val draft = UUID.randomUUID()
                val pinnedDraft = UUID.randomUUID()
                fun sql(
                    query: String,
                ): String = DriverManager.getConnection(db.jdbcUrl, db.username, db.password).use { c ->
                    c.createStatement().use { s ->
                        s.executeQuery(query).use { rows ->
                            check(rows.next())
                            rows.getString(1)
                        }
                    }
                }
                DriverManager.getConnection(db.jdbcUrl, db.username, db.password).use { c ->
                    c.createStatement().use { s ->
                        for ((id, boundary) in listOf(system to draft, pinned to pinnedDraft)) {
                            s.execute(
                                "INSERT INTO design_systems(id, project_name, project_id) VALUES ('$id', 'latest-$id', 'project')",
                            )
                            s.execute(
                                "INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, revision, published_at) VALUES ('${UUID.randomUUID()}', '$id', 'baseline', 0, 0, NULL), ('$boundary', '$id', 'draft', 1, 0, NULL)",
                            )
                            s.execute(
                                "INSERT INTO design_system_revisions(design_system_id, design_system_version_id, version_sequence_number, name, deleted) VALUES ('$id', '$boundary', 1, 'latest-$id', false)",
                            )
                        }
                    }
                }
                suspend fun post(path: String, body: String) = client.post(path) {
                    header("Idempotency-Key", UUID.randomUUID().toString())
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "latest-test")
                    header("X-Project-Id", "project")
                    header("X-System-Admin", "true")
                    contentType(ContentType.Application.Json)
                    setBody(body)
                }
                val components = """[{"name":"LatestProbe","properties":[{"name":"fill","type":"color","platformNames":["fill"]}]}]"""
                suspend fun import(version: String, channel: String = "stable", dry: Boolean = false) = post(
                    "/api/admin/component-config/import-api-meta",
                    coreReleasePayload(
                        version,
                        components,
                    ).replace(
                        "\"channel\":\"stable\"",
                        "\"channel\":\"$channel\"",
                    ).replace("\"dryRun\":false", "\"dryRun\":$dry"),
                )
                suspend fun select(
                    id: UUID,
                    boundary: String,
                    revision: Long,
                    mode: String,
                    channel: String = "stable",
                    release: String? = null,
                    platform: String = "compose",
                ) = client.put("/api/design-systems/$id/core-settings/$platform") {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "latest-test")
                    header("X-Project-Id", "project")
                    header("X-System-Admin", "true")
                    contentType(ContentType.Application.Json)
                    setBody(
                        """{"channel":"$channel","selectionMode":"$mode","expectedDraftId":"$boundary","expectedCoreSelectionRevision":$revision${release?.let { ",\"releaseId\":\"$it\"" }.orEmpty()}}""",
                    )
                }
                suspend fun read(
                    id: UUID = system,
                    version: String = "",
                ) = client.get("/api/design-systems/$id/core-settings$version") {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "latest-test")
                    header("X-Project-Id", "project")
                    header("X-System-Admin", "true")
                }
                suspend fun context(
                    response: HttpResponse,
                ) = Json.parseToJsonElement(response.bodyAsText()).jsonObject.getValue("context").jsonObject
                suspend fun assertSelection(
                    id: UUID,
                    version: String,
                    revision: Long,
                    mode: String = "latest",
                    suffix: String = "",
                ) {
                    val ctx = context(read(id, suffix))
                    val core = ctx.getValue("coreReleases").jsonArray.single().jsonObject
                    assertEquals(version, core.getValue("version").jsonPrimitive.content)
                    assertEquals(mode, core["selectionMode"]?.jsonPrimitive?.content ?: "pinned")
                    if (suffix.isEmpty()) {
                        assertEquals(
                            revision.toString(),
                            ctx.getValue("coreSelectionRevision").jsonPrimitive.content,
                        )
                    }
                }
                val initialRevision = sql("SELECT resolved_draft_revision('$draft')")
                assertEquals(HttpStatusCode.BadRequest, select(system, "$draft", 0, "latest", platform = "xml").status)
                assertEquals(HttpStatusCode.OK, import("A").status)
                val a = sql("SELECT id FROM core_releases WHERE version = 'A'")
                assertEquals(HttpStatusCode.OK, select(system, "$draft", 0, "latest").status)
                assertEquals(HttpStatusCode.OK, select(pinned, "$pinnedDraft", 0, "pinned", release = a).status)
                assertEquals(HttpStatusCode.OK, select(system, "$draft", 1, "latest").status)
                assertSelection(system, "A", 1)
                assertEquals(HttpStatusCode.OK, import("B", dry = true).status)
                assertSelection(system, "A", 1)
                assertEquals("0", sql("SELECT count(*) FROM core_releases WHERE version = 'B'"))
                assertEquals(HttpStatusCode.OK, import("dev-B", "dev").status)
                assertSelection(system, "A", 1)
                assertEquals(HttpStatusCode.OK, import("B").status)
                assertSelection(system, "B", 2)
                assertSelection(pinned, "A", 1, "pinned")
                assertEquals(HttpStatusCode.OK, import("A").status)
                assertSelection(system, "B", 2)
                assertEquals(HttpStatusCode.Conflict, select(system, "$draft", 1, "latest").status)
                val b = sql("SELECT id FROM core_releases WHERE version = 'B'")
                assertEquals(HttpStatusCode.OK, select(system, "$draft", 2, "pinned", release = b).status)
                assertSelection(system, "B", 3, "pinned")
                assertEquals(HttpStatusCode.OK, import("C").status)
                assertSelection(system, "B", 3, "pinned")
                assertEquals(HttpStatusCode.OK, select(system, "$draft", 3, "latest").status)
                assertSelection(system, "C", 4)
                assertEquals(initialRevision, sql("SELECT resolved_draft_revision('$draft')"))
                val probe = sql("SELECT id FROM components WHERE name = 'LatestProbe'")
                val linked =
                    post(
                        "/api/design-systems/$system/design-system-components",
                        """{"componentId":"$probe","fromTemplate":true}""",
                    )
                assertEquals(HttpStatusCode.Created, linked.status, linked.bodyAsText())
                val created =
                    post(
                        "/api/design-systems/$system/appearances",
                        """{"componentId":"$probe","name":"latest-publication"}""",
                    )
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                val revision = sql("SELECT resolved_draft_revision('$draft')")
                val publication =
                    post(
                        "/api/design-systems/$system/versions",
                        """{"draftId":"$draft","draftRevision":$revision,"version":"1.0.0"}""",
                    )
                assertEquals(HttpStatusCode.Created, publication.status, publication.bodyAsText())
                assertSelection(system, "C", 4)
                assertSelection(system, "C", 0, "pinned", "?versionId=$draft")
                assertEquals(HttpStatusCode.OK, import("D").status)
                assertSelection(system, "D", 5)
                assertSelection(system, "C", 0, "pinned", "?versionId=$draft")
                assertSelection(pinned, "A", 1, "pinned")
                assertEquals(
                    "0",
                    sql(
                        "SELECT resolved_draft_revision(id) FROM design_system_versions WHERE design_system_id = '$system' AND status = 'draft'",
                    ),
                )
                coroutineScope {
                    val imported = async { import("race-E") }
                    val selected = async { select(pinned, "$pinnedDraft", 1, "latest") }
                    val importedResponse = imported.await()
                    val selectedResponse = selected.await()
                    assertEquals(HttpStatusCode.OK, importedResponse.status, importedResponse.bodyAsText())
                    assertEquals(HttpStatusCode.OK, selectedResponse.status, selectedResponse.bodyAsText())
                }
                val raceContext = context(read(pinned))
                val raceRelease = raceContext.getValue("coreReleases").jsonArray.single().jsonObject
                assertEquals("race-E", raceRelease.getValue("version").jsonPrimitive.content)
                assertEquals("latest", raceRelease.getValue("selectionMode").jsonPrimitive.content)
                // The waiting importer starts before the barrier owner's registration, but registers last.
                DriverManager.getConnection(db.jdbcUrl, db.username, db.password).use { owner ->
                    owner.autoCommit = false
                    owner.createStatement().use {
                        it.execute(
                            "SELECT pg_advisory_xact_lock(hashtextextended('core-release:compose', 0))",
                        )
                    }
                    coroutineScope {
                        val waiting = async { import("1.2.1") }
                        withTimeout(10_000) {
                            while (sql("SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%pg_advisory_xact_lock%'").toInt() == 0) delay(
                                20,
                            )
                        }
                        owner.createStatement().use {
                            it.execute(
                                "INSERT INTO core_releases(library_id, platform, version, source_meta, meta_sha256, normalized_meta, provenance, channel, created_at) SELECT library_id, platform, '1.3.0-peer', source_meta, meta_sha256, normalized_meta, provenance, channel, clock_timestamp() FROM core_releases WHERE version = 'race-E' AND platform = 'compose'",
                            )
                        }
                        owner.commit()
                        val result = waiting.await()
                        assertEquals(HttpStatusCode.OK, result.status, result.bodyAsText())
                    }
                }
                assertEquals(
                    "1.2.1",
                    sql(
                        "SELECT version FROM core_releases WHERE platform = 'compose' AND channel = 'stable' ORDER BY created_at DESC, id LIMIT 1",
                    ),
                )
                assertEquals(
                    "1.2.1",
                    context(
                        read(),
                    ).getValue("coreReleases").jsonArray.single().jsonObject.getValue("version").jsonPrimitive.content,
                )
                val emptyImport =
                    post("/api/admin/component-config/import-api-meta", coreReleasePayload("empty-F", "[]"))
                assertEquals(HttpStatusCode.OK, emptyImport.status, emptyImport.bodyAsText())
                val incompatible = Json.parseToJsonElement(read().bodyAsText()).jsonObject
                assertTrue(incompatible.getValue("blockingCount").jsonPrimitive.content.toInt() > 0)
                val blockedExport =
                    post("/api/design-systems/$system/component-config/export", """{"platform":"compose"}""")
                assertEquals(HttpStatusCode.Conflict, blockedExport.status, blockedExport.bodyAsText())
                assertSelection(system, "C", 0, "pinned", "?versionId=$draft")
                assertTrue(
                    sql("SELECT count(*) FROM design_system_versions WHERE design_system_id = '$system'").toInt() == 3,
                )
            }
        }
    }
}
