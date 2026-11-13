@file:Suppress("ktlint:standard:max-line-length")

package com.dsbuilder.ds.app

import com.dsbuilder.ds.components.data.ExposedCompatibilityChecker
import com.dsbuilder.ds.core.domain.ProjectId
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import java.security.MessageDigest
import java.sql.DriverManager
import java.util.Base64
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

/** Реальная БД проверяет атомарность импорта и неизменность релизов вместе с миграциями. */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class CoreReleaseImportPostgresIntegrationTest {
    @Test
    fun `release A survives B type change removal retry and invalid import`() {
        IsolatedPostgresDatabase.create().use { db ->
            testApplication {
                application { module(configuration(db)) }
                suspend fun import(version: String, properties: String, dryRun: Boolean = false) = client.post(
                    "/api/admin/component-config/import-api-meta",
                ) {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "core-release-test")
                    header("X-Project-Id", "global")
                    header("X-System-Admin", "true")
                    contentType(ContentType.Application.Json)
                    setBody(body(version, properties, dryRun))
                }
                val a = import("A", property("color"))
                assertEquals(HttpStatusCode.OK, a.status, a.bodyAsText())
                val propertyId = query(db, "SELECT id FROM properties WHERE name = 'releaseFill'")
                val b = import("B", property("typography"))
                assertEquals(HttpStatusCode.OK, b.status, b.bodyAsText())
                assertEquals("color", query(db, "SELECT type FROM properties WHERE id = '$propertyId'"))
                assertEquals(
                    "color,typography",
                    query(
                        db,
                        "SELECT string_agg(p.type::text, ',' ORDER BY r.version) FROM core_release_properties p JOIN core_releases r ON r.id = p.release_id WHERE r.provenance = 'imported'",
                    ),
                )
                assertEquals(HttpStatusCode.OK, import("A", property("color")).status)
                assertEquals("B", current(db))
                assertEquals(HttpStatusCode.Conflict, import("A", property("typography")).status)
                val count = query(db, "SELECT count(*) FROM core_releases")
                assertEquals(HttpStatusCode.UnprocessableEntity, import("C", property("unknown")).status)
                assertEquals(count, query(db, "SELECT count(*) FROM core_releases"))
                assertEquals("B", current(db))
                assertEquals(HttpStatusCode.OK, import("C", "", dryRun = true).status)
                assertEquals(count, query(db, "SELECT count(*) FROM core_releases"))
                assertEquals(HttpStatusCode.OK, import("C", "").status)
                assertEquals("C", current(db))
                assertEquals(
                    "0",
                    query(
                        db,
                        "SELECT count(*) FROM core_release_properties p JOIN core_releases r ON r.id = p.release_id WHERE r.version = 'C'",
                    ),
                )
                assertEquals(propertyId, query(db, "SELECT id FROM properties WHERE name = 'releaseFill'"))
                assertEquals("0", query(db, "SELECT count(*) FROM design_system_components"))
            }
        }
    }

    @Test
    fun `draft diagnoses removed properties without losing historical export and hidden settings do not block`() {
        IsolatedPostgresDatabase.create().use { db ->
            testApplication {
                application { module(configuration(db)) }
                suspend fun import(
                    version: String,
                    properties: String,
                ) = client.post("/api/admin/component-config/import-api-meta") {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "core-release-test")
                    header("X-Project-Id", "global")
                    header("X-System-Admin", "true")
                    contentType(ContentType.Application.Json)
                    setBody(body(version, properties, false))
                }
                val deprecated = property(
                    "color",
                ).replace("[\"fill\"]", """[{"name":"fill","deprecated":{"message":"old"}}]""")
                assertEquals(HttpStatusCode.OK, import("A", deprecated).status)
                val fixture = seedSettings(db)
                val database = Database.connect(
                    db.jdbcUrl,
                    driver = "org.postgresql.Driver",
                    user = db.username,
                    password = db.password,
                )
                fun report(version: UUID? = null) = transaction(database) {
                    runBlocking { ExposedCompatibilityChecker().check(ProjectId("project"), fixture.system, version) }
                }
                assertEquals(0, report().blockingCount)
                assertEquals(1, report().warningCount)
                assertEquals(
                    HttpStatusCode.OK,
                    import("B", property("color").replace("releaseFill", "replacementFill")).status,
                )
                val conflicts = report()
                assertEquals(listOf("CORE_PROPERTY_REMOVED"), conflicts.items.map { it.code })
                assertEquals("#ff0000", conflicts.items.single().storedValue?.literal)
                assertEquals(fixture.value, conflicts.items.single().location.valueId)
                assertEquals(0, report(fixture.published).blockingCount)
                assertEquals(
                    "A",
                    report(fixture.published).context.coreReleases.single { it.ref.platform == "compose" }.ref.version,
                )
                assertEquals("B", conflicts.context.coreReleases.single { it.ref.platform == "compose" }.ref.version)
                assertEquals(
                    "0",
                    query(db, "SELECT revision FROM design_system_versions WHERE id = '${fixture.draft}'"),
                )
                val reportResponse = client.get("/api/design-systems/${fixture.system}/compatibility") {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "core-release-test")
                    header("X-Project-Id", "project")
                    header("X-System-Admin", "true")
                }
                assertEquals(HttpStatusCode.OK, reportResponse.status, reportResponse.bodyAsText())
                assertEquals(
                    "1",
                    Json.parseToJsonElement(
                        reportResponse.bodyAsText(),
                    ).jsonObject.getValue("blockingCount").jsonPrimitive.content,
                )
                suspend fun repair(
                    expected: Long,
                    target: String?,
                    viewer: Boolean = false,
                    system: UUID = fixture.system,
                    selector: String = "",
                ) = client.post("/api/design-systems/$system/compatibility/repair$selector") {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "core-release-test")
                    header("X-Project-Id", "project")
                    header("X-System-Admin", (!viewer).toString())
                    if (viewer) header("X-Project-Role", "viewer")
                    header("Idempotency-Key", UUID.randomUUID().toString())
                    contentType(ContentType.Application.Json)
                    setBody(
                        """{"appearanceId":"${fixture.appearance}","valueKind":"invariant","valueId":"${fixture.value}","expectedRevision":$expected,"targetPropertyId":${target?.let(::JsonPrimitive) ?: "null"}}""",
                    )
                }
                suspend fun exported(version: UUID? = null) = client.post(
                    "/api/design-systems/${fixture.system}/component-config/export" +
                        (version?.let { "?versionId=$it" } ?: ""),
                ) {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "core-release-test")
                    header("X-Project-Id", "project")
                    header("X-System-Admin", "true")
                    contentType(ContentType.Application.Json)
                    setBody("""{"platform":"compose"}""")
                }
                val blockedExport = exported()
                assertEquals(HttpStatusCode.Conflict, blockedExport.status, blockedExport.bodyAsText())
                val blockedBody = Json.parseToJsonElement(blockedExport.bodyAsText()).jsonObject
                assertEquals("CORE_COMPATIBILITY_CONFLICT", blockedBody.getValue("code").jsonPrimitive.content)
                assertEquals("1", blockedBody.getValue("blockingCount").jsonPrimitive.content)
                val historicalExport = exported(fixture.published)
                assertEquals(HttpStatusCode.OK, historicalExport.status, historicalExport.bodyAsText())
                val historicalMeta = Json.parseToJsonElement(
                    historicalExport.bodyAsText(),
                ).jsonObject.getValue("meta").jsonObject
                assertEquals(
                    "A",
                    historicalMeta.getValue(
                        "coreReleases",
                    ).jsonArray.single().jsonObject.getValue("version").jsonPrimitive.content,
                )
                val emptyPublication = client.post("/api/design-systems/${fixture.system}/versions") {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "core-release-test")
                    header("X-Project-Id", "project")
                    header("X-System-Admin", "true")
                    header("Idempotency-Key", UUID.randomUUID().toString())
                    contentType(ContentType.Application.Json)
                    setBody("""{"draftId":"${fixture.draft}","draftRevision":0,"version":"2.0.0"}""")
                }
                assertEquals(HttpStatusCode.Conflict, emptyPublication.status)
                assertEquals(
                    "DRAFT_EMPTY",
                    Json.parseToJsonElement(
                        emptyPublication.bodyAsText(),
                    ).jsonObject.getValue("code").jsonPrimitive.content,
                )
                val component = query(db, "SELECT id FROM components WHERE name = 'ReleaseButton'")
                for (path in listOf(
                    "components/$component",
                    "properties",
                    "property-platform-params",
                    "states",
                    "component-deps",
                )) {
                    suspend fun read(
                        selector: String,
                    ) = client.get("/api/design-systems/${fixture.system}/$path?$selector") {
                        header("X-Actor-Type", "user")
                        header("X-User-Id", "core-release-test")
                        header("X-Project-Id", "project")
                        header("X-System-Admin", "true")
                    }
                    val byId = read("versionId=${fixture.published}")
                    val byName = read("version=1.0.0")
                    assertEquals(HttpStatusCode.OK, byName.status, byName.bodyAsText())
                    assertEquals(byId.bodyAsText(), byName.bodyAsText(), path)
                    val selected = Json.parseToJsonElement(
                        requireNotNull(byName.headers["X-DS-Read-Context"]),
                    ).jsonObject
                    assertEquals(fixture.published.toString(), selected.getValue("versionId").jsonPrimitive.content)
                    val compose = selected.getValue("coreReleases").jsonArray.map {
                        it.jsonObject
                    }.single { it.getValue("platform").jsonPrimitive.content == "compose" }
                    assertEquals("A", compose.getValue("version").jsonPrimitive.content)
                    if (path == "properties") {
                        assertEquals(true, byName.bodyAsText().contains("releaseFill"))
                        assertEquals(false, byName.bodyAsText().contains("replacementFill"))
                    }
                    assertEquals(HttpStatusCode.NotFound, read("versionId=${UUID.randomUUID()}").status)
                }
                val target = query(db, "SELECT id FROM properties WHERE name = 'replacementFill'")
                val sourceRevision = conflicts.items.single().location.revision ?: 0
                for (selector in listOf("?version=1.0.0", "?versionId=${fixture.published}")) {
                    val historicalRepair = repair(sourceRevision, target, selector = selector)
                    assertEquals(HttpStatusCode.BadRequest, historicalRepair.status, historicalRepair.bodyAsText())
                    assertEquals(conflicts, report())
                }
                assertEquals(HttpStatusCode.Forbidden, repair(sourceRevision, target, viewer = true).status)
                assertEquals(HttpStatusCode.NotFound, repair(sourceRevision, target, system = UUID.randomUUID()).status)
                assertEquals(HttpStatusCode.Conflict, repair(sourceRevision + 1, target).status)
                assertEquals(1, report().blockingCount)

                DriverManager.getConnection(db.jdbcUrl, db.username, db.password).use { connection ->
                    connection.createStatement().use { statement ->
                        statement.execute(
                            "INSERT INTO design_system_component_revisions(design_system_component_id, design_system_id, design_system_version_id, version_sequence_number, deleted) VALUES ('${fixture.link}', '${fixture.system}', '${fixture.draft}', 2, true)",
                        )
                    }
                }
                assertEquals(0, report().blockingCount)
                assertEquals(0, report(fixture.published).blockingCount)
                DriverManager.getConnection(db.jdbcUrl, db.username, db.password).use { connection ->
                    connection.createStatement().use {
                        it.execute(
                            "DELETE FROM design_system_component_revisions WHERE design_system_component_id = '${fixture.link}' AND version_sequence_number = 2",
                        )
                    }
                }
                assertEquals(1, report().blockingCount)
                val repaired = repair(sourceRevision, target)
                assertEquals(HttpStatusCode.OK, repaired.status, repaired.bodyAsText())
                assertEquals(0, report().blockingCount)
                assertEquals(0, report(fixture.published).blockingCount)
                assertEquals(
                    "#ff0000",
                    query(
                        db,
                        "SELECT value FROM invariant_property_value_revisions r JOIN invariant_property_values v ON v.id = r.invariant_property_value_id WHERE v.property_id = '$target' AND NOT r.deleted",
                    ),
                )
                val journal = client.get("/api/design-systems/${fixture.system}/changes") {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "core-release-test")
                    header("X-Project-Id", "project")
                    header("X-System-Admin", "true")
                }
                assertEquals(HttpStatusCode.OK, journal.status, journal.bodyAsText())
                val changes = Json.parseToJsonElement(journal.bodyAsText()).jsonArray.map { it.jsonObject }
                assertEquals(2, changes.size, journal.bodyAsText())
                val entries = changes.joinToString(",") { change ->
                    """{"changeId":${change.getValue(
                        "changeId",
                    )},"expectedRevision":${change.getValue("editRevision")}}"""
                }
                val reverted = client.post("/api/design-systems/${fixture.system}/changes/revert") {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "core-release-test")
                    header("X-Project-Id", "project")
                    header("X-System-Admin", "true")
                    header("Idempotency-Key", UUID.randomUUID().toString())
                    contentType(ContentType.Application.Json)
                    setBody("""{"changes":[$entries]}""")
                }
                assertEquals(HttpStatusCode.OK, reverted.status, reverted.bodyAsText())
                assertEquals(listOf("CORE_PROPERTY_REMOVED"), report().items.map { it.code })
                assertEquals("#ff0000", report().items.single().storedValue?.literal)
                assertEquals(0, report(fixture.published).blockingCount)
            }
        }
    }

    @Test
    fun `repair rejects transfer with adjustments atomically and removal clears them without changing history`() {
        IsolatedPostgresDatabase.create().use { db ->
            testApplication {
                application { module(configuration(db)) }
                suspend fun post(path: String, payload: String) = client.post(path) {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "core-release-test")
                    header("X-Project-Id", "project")
                    header("X-System-Admin", "true")
                    header("Idempotency-Key", UUID.randomUUID().toString())
                    contentType(ContentType.Application.Json)
                    setBody(payload)
                }
                assertEquals(
                    HttpStatusCode.OK,
                    post("/api/admin/component-config/import-api-meta", body("A", property("color"), false)).status,
                )
                val f = seedSettings(db)
                val param = query(db, "SELECT id FROM property_platform_params WHERE name = 'fill'")
                val offset = post(
                    "/api/design-systems/${f.system}/invariant-platform-param-adjustments",
                    """{"ipvId":"${f.value}","platformParamId":"$param","template":"offset ${'$'}1"}""",
                )
                assertEquals(HttpStatusCode.Created, offset.status, offset.bodyAsText())
                val imported =
                    post(
                        "/api/admin/component-config/import-api-meta",
                        body("B", property("color").replace("releaseFill", "replacementFill"), false),
                    )
                assertEquals(HttpStatusCode.OK, imported.status, imported.bodyAsText())
                val database = Database.connect(
                    db.jdbcUrl,
                    driver = "org.postgresql.Driver",
                    user = db.username,
                    password = db.password,
                )
                fun report(version: UUID? = null) = transaction(database) {
                    runBlocking { ExposedCompatibilityChecker().check(ProjectId("project"), f.system, version) }
                }
                val before = report()
                val issue = before.items.first()
                assertEquals(listOf("offset ${'$'}1"), issue.storedValue?.platformAdjustments?.map { it.template })
                val target = query(db, "SELECT id FROM properties WHERE name = 'replacementFill'")
                val request = """{"appearanceId":"${f.appearance}","valueKind":"invariant","valueId":"${f.value}","expectedRevision":${issue.location.revision ?: 0}}"""
                val transfer = post(
                    "/api/design-systems/${f.system}/compatibility/repair",
                    request.dropLast(1) + """, "targetPropertyId":"$target"}""",
                )
                assertEquals(HttpStatusCode.Conflict, transfer.status, transfer.bodyAsText())
                assertEquals(
                    "CORE_TRANSFER_PLATFORM_ADJUSTMENTS",
                    Json.parseToJsonElement(transfer.bodyAsText()).jsonObject.getValue("code").jsonPrimitive.content,
                )
                assertEquals(before, report())
                val removed = post("/api/design-systems/${f.system}/compatibility/repair", request)
                assertEquals(HttpStatusCode.OK, removed.status, removed.bodyAsText())
                assertEquals(0, report().blockingCount)
                assertEquals(0, report(f.published).blockingCount)
                val adjustmentId = Json.parseToJsonElement(
                    offset.bodyAsText(),
                ).jsonObject.getValue("id").jsonPrimitive.content
                assertEquals(
                    "0",
                    query(
                        db,
                        "SELECT count(*) FROM invariant_platform_param_adjustment_revisions WHERE invariant_platform_param_adjustment_id = '$adjustmentId' AND NOT deleted",
                    ),
                )
            }
        }
    }

    @Test
    fun `publication and ordinary edit wait for Core import and recheck the committed release`() {
        IsolatedPostgresDatabase.create().use { db ->
            testApplication {
                application { module(configuration(db)) }
                suspend fun post(path: String, payload: String) = client.post(path) {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "core-release-test")
                    header("X-Project-Id", "project")
                    header("X-System-Admin", "true")
                    header("Idempotency-Key", UUID.randomUUID().toString())
                    contentType(ContentType.Application.Json)
                    setBody(payload)
                }
                assertEquals(
                    HttpStatusCode.OK,
                    post("/api/admin/component-config/import-api-meta", body("A", property("color"), false)).status,
                )
                val f = seedSettings(db)
                val param = query(db, "SELECT id FROM property_platform_params WHERE name = 'fill'")
                val changed = post(
                    "/api/design-systems/${f.system}/invariant-platform-param-adjustments",
                    """{"ipvId":"${f.value}","platformParamId":"$param","value":"1"}""",
                )
                assertEquals(HttpStatusCode.Created, changed.status, changed.bodyAsText())
                val revision = query(db, "SELECT resolved_draft_revision('${f.draft}')")
                assertEquals(
                    HttpStatusCode.OK,
                    post("/api/admin/component-config/import-api-meta", body("B", property("integer"), false)).status,
                )
                assertEquals(revision, query(db, "SELECT resolved_draft_revision('${f.draft}')"))
                DriverManager.getConnection(db.jdbcUrl, db.username, db.password).use { importer ->
                    importer.createStatement().use {
                        it.executeUpdate(
                            "UPDATE core_current_releases SET release_id = (SELECT id FROM core_releases WHERE platform = 'compose' AND version = 'A') WHERE platform = 'compose'",
                        )
                    }
                    importer.autoCommit = false
                    // The same current-pointer row lock used by the release importer; B remains invisible until commit.
                    importer.createStatement().use {
                        it.executeUpdate(
                            "UPDATE core_current_releases SET release_id = (SELECT id FROM core_releases WHERE platform = 'compose' AND version = 'B') WHERE platform = 'compose'",
                        )
                    }
                    coroutineScope {
                        val publication = async {
                            post(
                                "/api/design-systems/${f.system}/versions",
                                """{"draftId":"${f.draft}","draftRevision":$revision,"version":"2.0.0"}""",
                            )
                        }
                        val edit = async {
                            client.patch("/api/design-systems/${f.system}/invariant-property-values/${f.value}") {
                                header("X-Actor-Type", "user")
                                header("X-User-Id", "core-release-test")
                                header("X-Project-Id", "project")
                                header("X-System-Admin", "true")
                                header("Idempotency-Key", UUID.randomUUID().toString())
                                contentType(ContentType.Application.Json)
                                setBody("""{"value":"#0000ff"}""")
                            }
                        }
                        withTimeout(10_000) {
                            while (query(db, "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%core_current_releases%'").toInt() < 2) delay(
                                20,
                            )
                        }
                        assertFalse(publication.isCompleted)
                        assertEquals("A", current(db))
                        importer.commit()
                        val edited = edit.await()
                        assertEquals(HttpStatusCode.UnprocessableEntity, edited.status, edited.bodyAsText())
                        val result = publication.await()
                        assertEquals(HttpStatusCode.Conflict, result.status, result.bodyAsText())
                        assertEquals(
                            "CORE_COMPATIBILITY_CONFLICT",
                            Json.parseToJsonElement(
                                result.bodyAsText(),
                            ).jsonObject.getValue("code").jsonPrimitive.content,
                        )
                    }
                }
                assertEquals("B", current(db))
                assertEquals(
                    "1",
                    query(
                        db,
                        "SELECT count(*) FROM design_system_versions WHERE design_system_id = '${f.system}' AND status = 'published'",
                    ),
                )
                assertEquals("draft", query(db, "SELECT status FROM design_system_versions WHERE id = '${f.draft}'"))
                assertEquals(revision, query(db, "SELECT resolved_draft_revision('${f.draft}')"))
            }
        }
    }

    @Test
    fun `ordinary edits use the new type and system states while removed component states stay diagnostic`() {
        IsolatedPostgresDatabase.create().use { db ->
            testApplication {
                application { module(configuration(db)) }
                suspend fun post(path: String, payload: String) = client.post(path) {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "core-release-test")
                    header("X-Project-Id", "project")
                    header("X-System-Admin", "true")
                    header("Idempotency-Key", UUID.randomUUID().toString())
                    contentType(ContentType.Application.Json)
                    setBody(payload)
                }
                val imported =
                    post("/api/admin/component-config/import-api-meta", body("A", property("color"), false, "custom"))
                assertEquals(HttpStatusCode.OK, imported.status, imported.bodyAsText())
                val f = seedSettings(db)
                val state = query(db, "SELECT id FROM states WHERE name = 'custom'")
                suspend fun setOfStates(id: String): String {
                    val result = post("/api/design-systems/catalog/state-sets/resolve", """{"stateIds":["$id"]}""")
                    assertEquals(
                        true,
                        result.status in listOf(HttpStatusCode.OK, HttpStatusCode.Created),
                        result.bodyAsText(),
                    )
                    return Json.parseToJsonElement(result.bodyAsText()).jsonObject.getValue("id").jsonPrimitive.content
                }
                val custom = setOfStates(state)
                val hovered = setOfStates("00000000-0000-4000-8000-000000000002")
                suspend fun edit(
                    payload: String,
                ) = client.patch("/api/design-systems/${f.system}/invariant-property-values/${f.value}") {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "core-release-test")
                    header("X-Project-Id", "project")
                    header("X-System-Admin", "true")
                    header("Idempotency-Key", UUID.randomUUID().toString())
                    contentType(ContentType.Application.Json)
                    setBody(payload)
                }
                assertEquals(HttpStatusCode.OK, edit("""{"stateSetId":"$custom"}""").status)
                assertEquals(
                    HttpStatusCode.OK,
                    post("/api/admin/component-config/import-api-meta", body("B", property("integer"), false)).status,
                )
                val database = Database.connect(
                    db.jdbcUrl,
                    driver = "org.postgresql.Driver",
                    user = db.username,
                    password = db.password,
                )
                fun report(version: UUID? = null) = transaction(database) {
                    runBlocking { ExposedCompatibilityChecker().check(ProjectId("project"), f.system, version) }
                }
                val before = report()
                assertEquals(
                    setOf("CORE_STATE_REMOVED", "CORE_VALUE_TYPE_CONFLICT"),
                    before.items.map { it.code }.toSet(),
                )
                assertEquals(listOf("custom"), before.items.first().location.states)
                assertEquals("#ff0000", before.items.first().storedValue?.literal)
                val rejected = edit("""{"value":"23"}""")
                assertEquals(HttpStatusCode.UnprocessableEntity, rejected.status, rejected.bodyAsText())
                assertEquals(before, report())
                val changed = edit("""{"value":"23","stateSetId":"$hovered"}""")
                assertEquals(HttpStatusCode.OK, changed.status, changed.bodyAsText())
                assertEquals(0, report().blockingCount)
                assertEquals(0, report(f.published).blockingCount)
                assertEquals("color", query(db, "SELECT type FROM properties WHERE name = 'releaseFill'"))
                assertEquals(
                    "0",
                    query(
                        db,
                        "SELECT count(*) FROM core_release_states WHERE state_id = '00000000-0000-4000-8000-000000000002'",
                    ),
                )
            }
        }
    }

    @Test
    fun `web CSS dimensions stay compatible and preserve export and ordinary edits`() {
        IsolatedPostgresDatabase.create().use { db ->
            testApplication {
                application { module(configuration(db)) }
                val request = body("A", property("dimension"), false)
                    .replace("\"compose\"", "\"web\"").replace("uikit-compose", "plasma-new-hope")
                val imported = client.post("/api/admin/component-config/import-api-meta") {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "core-release-test")
                    header("X-Project-Id", "project")
                    header("X-System-Admin", "true")
                    contentType(ContentType.Application.Json)
                    setBody(request)
                }
                assertEquals(HttpStatusCode.OK, imported.status, imported.bodyAsText())
                // Chip.width=auto is present in the shipped webBase snapshot; CSS dimensions are not only numbers.
                val f = seedSettings(db, "auto")
                val database = Database.connect(
                    db.jdbcUrl,
                    driver = "org.postgresql.Driver",
                    user = db.username,
                    password = db.password,
                )
                fun report() = transaction(database) {
                    runBlocking { ExposedCompatibilityChecker().check(ProjectId("project"), f.system, null) }
                }
                suspend fun export(version: UUID? = null) = client.post(
                    "/api/design-systems/${f.system}/component-config/export" + (version?.let { "?versionId=$it" } ?: ""),
                ) {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "core-release-test")
                    header("X-Project-Id", "project")
                    header("X-System-Admin", "true")
                    contentType(ContentType.Application.Json)
                    setBody("""{"platform":"web"}""")
                }
                assertEquals(0, report().blockingCount)
                val initial = export()
                assertEquals(HttpStatusCode.OK, initial.status, initial.bodyAsText())
                assertEquals(true, initial.bodyAsText().contains("auto"))
                for (literal in listOf("calc(100% - 8px)", "var(--chip-width)", "12rem", "auto")) {
                    val edited = client.patch("/api/design-systems/${f.system}/invariant-property-values/${f.value}") {
                        header("X-Actor-Type", "user")
                        header("X-User-Id", "core-release-test")
                        header("X-Project-Id", "project")
                        header("X-System-Admin", "true")
                        header("Idempotency-Key", UUID.randomUUID().toString())
                        contentType(ContentType.Application.Json)
                        setBody("""{"value":${JsonPrimitive(literal)}}""")
                    }
                    assertEquals(HttpStatusCode.OK, edited.status, edited.bodyAsText())
                    assertEquals(0, report().blockingCount)
                    val exported = export()
                    assertEquals(HttpStatusCode.OK, exported.status, exported.bodyAsText())
                    assertEquals(true, exported.bodyAsText().contains(literal))
                }
                val propertyId = query(db, "SELECT id FROM properties WHERE name = 'releaseFill'")
                val editorWrite = client.put(
                    "/api/design-systems/${f.system}/appearances/${f.appearance}/property-values",
                ) {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "core-release-test")
                    header("X-Project-Id", "project")
                    header("X-System-Admin", "true")
                    contentType(ContentType.Application.Json)
                    setBody("""{"propertyId":"$propertyId","styleIds":[],"states":[],"value":"auto"}""")
                }
                assertEquals(HttpStatusCode.OK, editorWrite.status, editorWrite.bodyAsText())
                assertEquals(0, report().blockingCount)
                val historical = export(f.published)
                assertEquals(HttpStatusCode.OK, historical.status, historical.bodyAsText())
                assertEquals(true, historical.bodyAsText().contains("auto"))
            }
        }
    }

    private data class SettingsFixture(
        val baseline: UUID = UUID.randomUUID(),
        val system: UUID = UUID.randomUUID(),
        val published: UUID = UUID.randomUUID(),
        val draft: UUID = UUID.randomUUID(),
        val link: UUID = UUID.randomUUID(),
        val appearance: UUID = UUID.randomUUID(),
        val value: UUID = UUID.randomUUID(),
    )

    private fun seedSettings(db: IsolatedPostgresDatabase, literal: String = "#ff0000"): SettingsFixture {
        val f = SettingsFixture()
        val component = query(db, "SELECT id FROM components WHERE name = 'ReleaseButton'")
        val property = query(db, "SELECT id FROM properties WHERE name = 'releaseFill'")
        DriverManager.getConnection(db.jdbcUrl, db.username, db.password).use { connection ->
            connection.createStatement().use { s ->
                s.execute(
                    "INSERT INTO design_systems(id, project_name, project_id) VALUES ('${f.system}', 'core-release-fixture', 'project')",
                )
                s.execute(
                    "INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, revision, published_at) VALUES ('${f.baseline}', '${f.system}', 'baseline', 0, 0, NULL)",
                )
                s.execute(
                    "INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, revision, published_at) VALUES ('${f.published}', '${f.system}', 'draft', 1, 0, NULL)",
                )
                s.execute(
                    "INSERT INTO design_system_revisions(design_system_id, design_system_version_id, version_sequence_number, name, deleted) VALUES ('${f.system}', '${f.published}', 1, 'Core fixture', false)",
                )
                s.execute(
                    "INSERT INTO design_system_components(id, design_system_id, component_id) VALUES ('${f.link}', '${f.system}', '$component')",
                )
                s.execute(
                    "INSERT INTO design_system_component_revisions(design_system_component_id, design_system_id, design_system_version_id, version_sequence_number, deleted) VALUES ('${f.link}', '${f.system}', '${f.published}', 1, false)",
                )
                s.execute(
                    "INSERT INTO appearances(id, design_system_id, component_id) VALUES ('${f.appearance}', '${f.system}', '$component')",
                )
                s.execute(
                    "INSERT INTO appearance_revisions(appearance_id, design_system_id, design_system_version_id, version_sequence_number, name, deleted) VALUES ('${f.appearance}', '${f.system}', '${f.published}', 1, 'default', false)",
                )
                s.execute(
                    "INSERT INTO invariant_property_values(id, design_system_id, component_id, property_id, appearance_id) VALUES ('${f.value}', '${f.system}', '$component', '$property', '${f.appearance}')",
                )
                s.execute(
                    "INSERT INTO invariant_property_value_revisions(invariant_property_value_id, design_system_id, design_system_version_id, version_sequence_number, value, position, state_set_id, deleted) SELECT '${f.value}', '${f.system}', '${f.published}', 1, '$literal', 0, id, false FROM state_sets WHERE cardinality(state_ids) = 0 LIMIT 1",
                )
                s.execute(
                    "UPDATE design_system_versions SET status = 'published', version = '1.0.0', published_at = now() WHERE id = '${f.published}'",
                )
                s.execute(
                    "INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, revision, published_at) VALUES ('${f.draft}', '${f.system}', 'draft', 2, 0, NULL)",
                )
                s.execute(
                    "INSERT INTO design_system_version_core_releases(version_id, platform, release_id) SELECT '${f.published}', platform, release_id FROM core_current_releases",
                )
                s.execute(
                    "INSERT INTO design_system_version_preview_builds(version_id, platform, release_id) SELECT version_id, platform, release_id FROM design_system_version_core_releases WHERE version_id = '${f.published}'",
                )
            }
        }
        return f
    }

    private fun property(type: String) = """{"name":"releaseFill","type":"$type","platformNames":["fill"]}"""

    private fun body(version: String, properties: String, dryRun: Boolean, state: String? = null): String {
        val components = """[{"name":"ReleaseButton","properties":[$properties],"states":[${state?.let(::JsonPrimitive) ?: ""}]}]"""
        val bytes = components.toByteArray()
        val hash = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        return """{"platform":"compose","dryRun":$dryRun,"components":$components,"coreRelease":{"libraryId":"uikit-compose","platform":"compose","version":${JsonPrimitive(
            version,
        )}},"sourceMetaBase64":"${Base64.getEncoder().encodeToString(bytes)}","metaSha256":"$hash"}"""
    }

    private fun current(db: IsolatedPostgresDatabase) = query(
        db,
        "SELECT version FROM core_releases r JOIN core_current_releases c ON c.release_id = r.id WHERE c.platform = 'compose'",
    )

    private fun query(db: IsolatedPostgresDatabase, sql: String): String =
        DriverManager.getConnection(db.jdbcUrl, db.username, db.password).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery(sql).use { rows ->
                    check(rows.next())
                    rows.getString(1)
                }
            }
        }

    private fun configuration(db: IsolatedPostgresDatabase) = DsServiceConfiguration(
        port = 0, databaseUrl = db.jdbcUrl, databaseUser = db.username, databasePassword = db.password,
        databasePoolSize = 4, databaseConnectionTimeoutMs = 5_000, authorizationPolicyPath = null,
        runFlyway = true, adoptExistingSchema = false, expectedSchemaFingerprint = null,
    )
}
