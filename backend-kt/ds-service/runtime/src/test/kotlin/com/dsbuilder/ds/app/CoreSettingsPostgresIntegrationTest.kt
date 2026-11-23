@file:Suppress("ktlint:standard:max-line-length")

package com.dsbuilder.ds.app

import com.dsbuilder.testing.IntegrationTest
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
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.experimental.categories.Category
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Две обычные ДС сохраняют независимый выбор, ревизии и право возврата к прежнему Core. */
@Category(IntegrationTest::class)
class CoreSettingsPostgresIntegrationTest {
    @Test
    fun `import never switches systems and selection is atomic and revision guarded`() {
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
                val systemA = UUID.randomUUID()
                val systemB = UUID.randomUUID()
                val draftA = UUID.randomUUID()
                val draftB = UUID.randomUUID()
                val globalSystem = UUID.randomUUID()
                val globalDraft = UUID.randomUUID()
                DriverManager.getConnection(db.jdbcUrl, db.username, db.password).use { conn ->
                    conn.createStatement().use { s ->
                        for ((system, draft) in listOf(
                            systemA to draftA,
                            systemB to draftB,
                            globalSystem to globalDraft,
                        )) {
                            val project = if (system == globalSystem) "NULL" else "'project'"
                            s.execute(
                                "INSERT INTO design_systems(id, project_name, project_id) VALUES ('$system', 'core-$system', $project)",
                            )
                            s.execute(
                                "INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, revision, published_at) VALUES ('${UUID.randomUUID()}', '$system', 'baseline', 0, 0, NULL)",
                            )
                            s.execute(
                                "INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, revision, published_at) VALUES ('$draft', '$system', 'draft', 1, 0, NULL)",
                            )
                            s.execute(
                                "INSERT INTO design_system_revisions(design_system_id, design_system_version_id, version_sequence_number, name, deleted) VALUES ('$system', '$draft', 1, 'core-$system', false)",
                            )
                        }
                    }
                }
                suspend fun import(
                    version: String,
                    channel: String,
                    platform: String = "compose",
                ) = client.post("/api/admin/component-config/import-api-meta") {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "core-test")
                    header("X-Project-Id", "project")
                    header("X-System-Admin", "true")
                    contentType(ContentType.Application.Json)
                    setBody(
                        coreReleasePayload(
                            version,
                            if (version == "B") """[{"name":"CoreChannelProbe","properties":[{"name":"fill","type":"color","platformNames":["fill"]}]}]""" else "[]",
                        )
                            .replace("\"channel\":\"stable\"", "\"channel\":\"$channel\"")
                            .replace("\"platform\":\"compose\"", "\"platform\":\"$platform\""),
                    )
                }
                suspend fun read(system: UUID) = client.get("/api/design-systems/$system/core-settings") {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "core-test")
                    header("X-Project-Id", "project")
                    header("X-System-Admin", "true")
                }
                suspend fun select(
                    system: UUID,
                    draft: UUID,
                    release: String,
                    channel: String,
                    revision: Long,
                    platform: String = "compose",
                ) = client.put("/api/design-systems/$system/core-settings/$platform") {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "core-test")
                    header("X-Project-Id", "project")
                    header("X-System-Admin", "true")
                    contentType(ContentType.Application.Json)
                    setBody(
                        """{"channel":"$channel","releaseId":"$release","expectedDraftId":"$draft","expectedCoreSelectionRevision":$revision}""",
                    )
                }
                fun release(
                    version: String,
                ): String = DriverManager.getConnection(db.jdbcUrl, db.username, db.password).use { conn ->
                    conn.createStatement().use { s ->
                        s.executeQuery(
                            "SELECT id FROM core_releases WHERE version = '$version'",
                        ).use {
                            it.next()
                            it.getString(1)
                        }
                    }
                }
                val unselected = Json.parseToJsonElement(
                    read(systemA).bodyAsText(),
                ).jsonObject.getValue("context").jsonObject
                assertEquals("[]", unselected.getValue("coreReleases").toString())
                val emptyCatalog = client.get(
                    "/api/design-systems/$systemA/core-releases?platform=compose&channel=stable",
                ) {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "viewer")
                    header("X-Project-Id", "project")
                    header("X-Project-Role", "viewer")
                }
                assertEquals(HttpStatusCode.OK, emptyCatalog.status, emptyCatalog.bodyAsText())
                assertEquals("[]", emptyCatalog.bodyAsText())
                assertEquals(HttpStatusCode.OK, import("A", "stable").status)
                val a = release("A")
                val globalWrite = client.put("/api/design-systems/$globalSystem/core-settings/compose") {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "owner")
                    header("X-Project-Id", "project")
                    header("X-Project-Role", "owner")
                    contentType(ContentType.Application.Json)
                    setBody(
                        """{"channel":"stable","releaseId":"$a","expectedDraftId":"$globalDraft","expectedCoreSelectionRevision":0}""",
                    )
                }
                assertEquals(HttpStatusCode.NotFound, globalWrite.status, globalWrite.bodyAsText())
                val unchangedGlobal = Json.parseToJsonElement(
                    read(globalSystem).bodyAsText(),
                ).jsonObject.getValue("context").jsonObject
                assertEquals("0", unchangedGlobal.getValue("coreSelectionRevision").toString())
                assertEquals("[]", unchangedGlobal.getValue("coreReleases").toString())

                assertEquals(HttpStatusCode.OK, select(systemA, draftA, a, "stable", 0).status)
                assertEquals(HttpStatusCode.OK, select(systemB, draftB, a, "stable", 0).status)
                val denied = client.put("/api/design-systems/$systemA/core-settings/compose") {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "viewer")
                    header("X-Project-Id", "project")
                    header("X-Project-Role", "viewer")
                    contentType(ContentType.Application.Json)
                    setBody(
                        """{"channel":"stable","releaseId":"$a","expectedDraftId":"$draftA","expectedCoreSelectionRevision":1}""",
                    )
                }
                assertEquals(HttpStatusCode.Forbidden, denied.status)
                for (suffix in listOf(
                    "core-settings",
                    "core-releases?platform=compose&channel=stable",
                    "core-settings?versionId=$draftB",
                )) {
                    val foreign = client.get("/api/design-systems/$systemA/$suffix") {
                        header("X-Actor-Type", "user")
                        header("X-User-Id", "foreign")
                        header("X-Project-Id", "other")
                        header("X-Project-Role", "owner")
                    }
                    assertEquals(HttpStatusCode.NotFound, foreign.status, foreign.bodyAsText())
                }
                val foreignVersion = client.get("/api/design-systems/$systemA/core-settings?versionId=$draftB") {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "core-test")
                    header("X-Project-Id", "project")
                    header("X-System-Admin", "true")
                }
                assertEquals(HttpStatusCode.NotFound, foreignVersion.status, foreignVersion.bodyAsText())
                val limited = client.get("/api/design-systems/$systemA/core-settings") {
                    header("X-Actor-Type", "personal_access_token")
                    header("X-Personal-Access-Token-Id", "settings-only")
                    header("X-User-Id", "owner")
                    header("X-Project-Id", "project")
                    header("X-Project-Role", "owner")
                    header("X-Project-Scopes", "design-systems:read")
                }
                assertEquals(HttpStatusCode.OK, limited.status, limited.bodyAsText())
                assertEquals(
                    setOf("context", "blockingCount", "warningCount"),
                    Json.parseToJsonElement(limited.bodyAsText()).jsonObject.keys,
                )
                val deniedDetails = client.get("/api/design-systems/$systemA/compatibility") {
                    header("X-Actor-Type", "personal_access_token")
                    header("X-Personal-Access-Token-Id", "settings-only")
                    header("X-User-Id", "owner")
                    header("X-Project-Id", "project")
                    header("X-Project-Role", "owner")
                    header("X-Project-Scopes", "design-systems:read")
                }
                assertEquals(HttpStatusCode.Forbidden, deniedDetails.status)
                val beforeA = read(systemA).bodyAsText()
                val beforeB = read(systemB).bodyAsText()
                assertEquals(HttpStatusCode.OK, import("B", "dev").status)
                val b = release("B")
                assertEquals(beforeA, read(systemA).bodyAsText())
                assertEquals(beforeB, read(systemB).bodyAsText())
                assertEquals(HttpStatusCode.BadRequest, select(systemA, draftA, b, "stable", 1).status)
                assertEquals(beforeA, read(systemA).bodyAsText())
                val selected = select(systemA, draftA, b, "dev", 1)
                assertEquals(HttpStatusCode.OK, selected.status, selected.bodyAsText())
                val context = Json.parseToJsonElement(selected.bodyAsText()).jsonObject.getValue("context").jsonObject
                assertEquals("2", context.getValue("coreSelectionRevision").toString())
                val previousContext = Json.parseToJsonElement(beforeA).jsonObject.getValue("context").jsonObject
                assertEquals(previousContext.getValue("draftRevision"), context.getValue("draftRevision"))
                val staleWrite = client.patch("/api/design-systems/$systemA") {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "core-test")
                    header("X-Project-Id", "project")
                    header("X-System-Admin", "true")
                    header("X-DS-Core-Selection-Revision", "1")
                    contentType(ContentType.Application.Json)
                    setBody("""{"name":"stale change"}""")
                }
                assertEquals(HttpStatusCode.Conflict, staleWrite.status, staleWrite.bodyAsText())
                assertTrue(staleWrite.bodyAsText().contains("CORE_SELECTION_STALE"))
                assertTrue(context.getValue("coreReleases").toString().contains(b))
                assertEquals(beforeB, read(systemB).bodyAsText())
                assertEquals(HttpStatusCode.Conflict, select(systemA, draftA, a, "stable", 1).status)
                assertEquals(HttpStatusCode.Conflict, select(systemA, draftB, a, "stable", 2).status)
                assertEquals(HttpStatusCode.OK, select(systemA, draftA, a, "stable", 2).status)
                val probe = DriverManager.getConnection(db.jdbcUrl, db.username, db.password).use { connection ->
                    connection.createStatement().use { statement ->
                        statement.executeQuery(
                            "SELECT id FROM components WHERE name = 'CoreChannelProbe'",
                        ).use { rows ->
                            check(rows.next())
                            rows.getString(1)
                        }
                    }
                }
                suspend fun catalog(system: UUID) = client.get("/api/design-systems/$system/components/$probe") {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "owner")
                    header("X-Project-Id", "project")
                    header("X-Project-Role", "owner")
                }.bodyAsText()
                assertTrue(!catalog(systemA).contains("CoreChannelProbe"))
                assertEquals(HttpStatusCode.OK, select(systemA, draftA, b, "dev", 3).status)
                assertTrue(catalog(systemA).contains("CoreChannelProbe"))
                assertTrue(!catalog(systemB).contains("CoreChannelProbe"))
                for ((path, expected) in listOf(
                    "catalog/components" to "CoreChannelProbe",
                    "components/$probe/properties" to "fill",
                    "component-templates" to "CoreChannelProbe",
                )) {
                    val metadata = client.get("/api/design-systems/$systemA/$path") {
                        header("X-Actor-Type", "user")
                        header("X-User-Id", "owner")
                        header("X-Project-Id", "project")
                        header("X-Project-Role", "owner")
                    }
                    assertEquals(HttpStatusCode.OK, metadata.status, metadata.bodyAsText())
                    assertTrue(metadata.bodyAsText().contains(expected), metadata.bodyAsText())
                }
                val added = client.post("/api/design-systems/$systemA/design-system-components") {
                    header("X-Actor-Type", "user")
                    header("X-User-Id", "owner")
                    header("X-Project-Id", "project")
                    header("X-Project-Role", "owner")
                    contentType(ContentType.Application.Json)
                    setBody("""{"componentId":"$probe","fromTemplate":true}""")
                }
                assertEquals(HttpStatusCode.Created, added.status, added.bodyAsText())
                assertEquals(HttpStatusCode.OK, import("Web-A", "stable", "web").status)
                assertEquals(HttpStatusCode.OK, select(systemA, draftA, release("Web-A"), "stable", 4, "web").status)
                val independent = read(systemA).bodyAsText()
                assertTrue(independent.contains(b))
                assertTrue(independent.contains(release("Web-A")))
                assertEquals(beforeB, read(systemB).bodyAsText())
            }
        }
    }
}
