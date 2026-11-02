package com.dsbuilder.ds.app

import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.sql.DriverManager
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Хранение ролей корня и цветовой схемы: заливка, выгрузка и ручки осей appearance. */
class AppearanceAxisRolesHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = false }

    @Test
    fun `an explicit root survives import and export even when size exists`() = withService {
        val ds = designSystem()
        val imported = importConfig(ds, "default", config(root = "shape", scheme = "view", "shape", "size", "view"))
        assertEquals(HttpStatusCode.OK, imported.status, imported.bodyAsText())

        val config = exported(ds, "default")
        assertEquals("shape", config.string("rootVariationId"))
        assertEquals("view", config.string("colorSchemeVariationId"))
        assertEquals(
            "1",
            query("SELECT count(*) FROM ($RESOLVED_APPEARANCES) resolved WHERE root_variation_id IS NOT NULL"),
        )
        assertEquals("1", colorSchemeAxisCount())
    }

    @Test
    fun `an absent root falls back to size and then to the first axis other than the colour scheme`() = withService {
        val ds = designSystem()
        importConfig(ds, "with-size", config(root = null, scheme = null, "shape", "size"))
        importConfig(ds, "no-size", config(root = null, scheme = "view", "view", "shape", "state"))
        importConfig(ds, "only-scheme", config(root = null, scheme = "view", "view"))

        assertEquals("size", exported(ds, "with-size").string("rootVariationId"))
        assertEquals("shape", exported(ds, "no-size").string("rootVariationId"))
        assertEquals("view", exported(ds, "no-size").string("colorSchemeVariationId"))
        assertNull(exported(ds, "only-scheme").string("rootVariationId"))
    }

    @Test
    fun `a root that names no axis rejects the entry and leaves nothing behind`() = withService {
        val ds = designSystem()
        val response = importConfig(ds, "broken", config(root = "missing", scheme = null, "shape", "size"))
        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        val rejected = json.parseToJsonElement(response.bodyAsText()).jsonObject.getValue("rejected").jsonArray
        assertEquals(1, rejected.size)
        assertEquals("0", query("SELECT count(*) FROM ($RESOLVED_APPEARANCES) resolved"))
    }

    @Test
    fun `a repeated import keeps roles and reports the appearance unchanged`() = withService {
        val ds = designSystem()
        val body = config(root = "shape", scheme = "view", "shape", "size", "view")
        importConfig(ds, "default", body)
        val initialState = componentImportState(includeRevisions = true)
        val again = importConfig(ds, "default", body)
        assertEquals(HttpStatusCode.OK, again.status, again.bodyAsText())
        assertEquals(
            "1",
            json.parseToJsonElement(again.bodyAsText()).jsonObject.getValue("unchanged").jsonPrimitive.content,
        )
        assertEquals("shape", exported(ds, "default").string("rootVariationId"))
        assertEquals(initialState, componentImportState(includeRevisions = true))
    }

    @Test
    fun `changing axis order preserves the identities of all imported children`() = withService {
        val ds = designSystem()
        val first = importConfig(ds, "default", config(root = "shape", scheme = "view", "shape", "size", "view"))
        assertEquals(HttpStatusCode.OK, first.status, first.bodyAsText())
        val identities = componentImportState(includeRevisions = false)
        val changed = importConfig(ds, "default", config(root = "shape", scheme = "view", "size", "shape", "view"))
        assertEquals(HttpStatusCode.OK, changed.status, changed.bodyAsText())
        assertEquals("1", json.parseToJsonElement(changed.bodyAsText()).jsonObject["updated"]?.jsonPrimitive?.content)
        assertEquals(identities, componentImportState(includeRevisions = false))
        val after = componentImportState(includeRevisions = true)
        val repeated = importConfig(ds, "default", config(root = "shape", scheme = "view", "size", "shape", "view"))
        assertEquals(HttpStatusCode.OK, repeated.status, repeated.bodyAsText())
        assertEquals(after, componentImportState(includeRevisions = true))
    }

    private fun componentImportState(includeRevisions: Boolean): List<String> {
        val tables = listOf(
            "appearances", "appearance_variations", "appearance_variation_values", "styles",
            "appearance_combinations", "appearance_combination_members", "invariant_property_values",
            "variation_property_values", "style_combinations", "style_combination_members",
            "component_style_references", "component_style_reference_styles",
        ) + if (includeRevisions) {
            listOf(
                "appearance_revisions", "appearance_variation_revisions", "appearance_variation_value_revisions",
                "style_revisions", "appearance_combination_revisions", "appearance_combination_member_revisions",
                "invariant_property_value_revisions", "variation_property_value_revisions",
                "style_combination_revisions", "style_combination_member_revisions",
                "component_style_reference_revisions", "component_style_reference_style_revisions",
                "entity_edit_states", "entity_edit_paths", "draft_transaction_markers",
            )
        } else {
            emptyList()
        }
        return tables.map { table ->
            query(
                "SELECT COALESCE(string_agg(to_jsonb(row)::text, ';' ORDER BY to_jsonb(row)::text), '') " +
                    "FROM $table row",
            )
        }
    }

    @Test
    fun `axis endpoints report both roles and move them`() = withService {
        val ds = designSystem()
        importConfig(ds, "default", config(root = "shape", scheme = "view", "shape", "size", "view"))
        val appearance = appearanceId()

        var axes = axes(appearance)
        assertEquals(setOf("shape"), axes.rootNames())
        assertEquals(setOf("view"), axes.schemeNames())

        val sizeAxis = axes.axisId("size")
        val viewAxis = axes.axisId("view")
        val shapeAxis = axes.axisId("shape")
        val appearanceRevision = editRevision("appearance", appearance)
        val sizeAxisRevision = editRevision("appearance-variation", sizeAxis)

        val moved = patch(
            "/api/ds/appearance-variations/$sizeAxis",
            """{"isRoot":true}""",
            appearanceRevision,
        )
        assertEquals(HttpStatusCode.OK, moved.status, moved.bodyAsText())
        assertTrue(moved.headers["X-DS-Mutation-Metadata"].orEmpty().contains("\"warnings\": []"))
        assertEquals(sizeAxisRevision, editRevision("appearance-variation", sizeAxis))
        assertEquals("/root_variation_id", latestPaths("appearance", appearance, appearanceRevision + 1))
        axes = axes(appearance)
        assertEquals(setOf("size"), axes.rootNames())

        val conflict = patch("/api/ds/appearance-variations/$viewAxis", """{"isRoot":true}""")
        assertEquals(HttpStatusCode.Conflict, conflict.status, conflict.bodyAsText())
        assertEquals(setOf("size"), axes(appearance).rootNames())
        assertEquals(setOf("view"), axes(appearance).schemeNames())

        val schemeMoved = patch(
            "/api/ds/appearance-variations/$shapeAxis",
            """{"isColorScheme":true}""",
            appearanceRevision,
        )
        assertEquals(HttpStatusCode.OK, schemeMoved.status, schemeMoved.bodyAsText())
        assertTrue(schemeMoved.headers["X-DS-Mutation-Metadata"].orEmpty().contains("\"warnings\": []"))
        assertEquals(setOf("shape"), axes(appearance).schemeNames())
        assertEquals("1", colorSchemeAxisCount())

        val released = patch(
            "/api/ds/appearance-variations/$shapeAxis",
            """{"isColorScheme":false}""",
            appearanceRevision,
        )
        assertEquals(HttpStatusCode.OK, released.status)
        assertTrue(
            released.headers["X-DS-Mutation-Metadata"].orEmpty()
                .contains("\"warnings\": [\"/color_scheme_variation_id\"]"),
        )
        assertEquals(emptySet(), axes(appearance).schemeNames())
        assertEquals("0", colorSchemeAxisCount())
    }

    @Test
    fun `unchanged axis roles do not create an edit and mixed request records only the changed role`() = withService {
        val ds = designSystem()
        importConfig(ds, "default", config(root = "shape", scheme = "view", "shape", "size", "view"))
        val appearance = appearanceId()
        val axes = axes(appearance)
        val shapeAxis = axes.axisId("shape")
        val viewAxis = axes.axisId("view")
        val revision = editRevision("appearance", appearance)

        val repeated = patch(
            "/api/ds/appearance-variations/$shapeAxis",
            """{"isRoot":true}""",
            revision,
        )
        assertEquals(HttpStatusCode.OK, repeated.status, repeated.bodyAsText())
        assertEquals(revision, editRevision("appearance", appearance))

        val mixed = patch(
            "/api/ds/appearance-variations/$viewAxis",
            """{"isRoot":false,"isColorScheme":false}""",
            revision,
        )
        assertEquals(HttpStatusCode.OK, mixed.status, mixed.bodyAsText())
        assertEquals(revision + 1, editRevision("appearance", appearance))
        assertEquals("/color_scheme_variation_id", latestPaths("appearance", appearance, revision + 1))
    }

    @Test
    fun `deleting the root axis reassigns the root by the fallback order`() = withService {
        val ds = designSystem()
        importConfig(ds, "default", config(root = "size", scheme = "view", "view", "shape", "size"))
        val appearance = appearanceId()
        val sizeAxis = axes(appearance).axisId("size")

        val deleted = delete("/api/ds/appearance-variations/$sizeAxis")
        assertEquals(HttpStatusCode.OK, deleted.status, deleted.bodyAsText())
        assertEquals(setOf("shape"), axes(appearance).rootNames())
        assertEquals(setOf("view"), axes(appearance).schemeNames())

        // Ось цветовой схемы заблокирована: её нельзя удалить, роли остаются как были.
        val viewAxis = axes(appearance).axisId("view")
        assertEquals(HttpStatusCode.UnprocessableEntity, delete("/api/ds/appearance-variations/$viewAxis").status)
        assertEquals(setOf("view"), axes(appearance).schemeNames())
        assertEquals(
            "shape",
            query(
                "SELECT name FROM $RESOLVED_VARIATIONS_TEST_SQL variations " +
                    "WHERE id = (SELECT root_variation_id FROM ($RESOLVED_APPEARANCES) resolved)",
            ),
        )
    }

    @Test
    fun `the first axis created through the endpoint becomes the root`() = withService {
        val ds = designSystem()
        importConfig(ds, "default", config(root = null, scheme = null))
        val appearance = appearanceId()
        val component = query("SELECT id FROM components WHERE name = 'Button'")
        val variation = id(
            post(
                "/api/ds/variations",
                """{"designSystemId":"$ds","componentId":"$component","name":"shape"}""",
            ).bodyAsText(),
        )
        val created = post(
            "/api/ds/appearance-variations",
            """{"appearanceId":"$appearance","variationId":"$variation","position":0}""",
        )
        assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
        assertEquals(setOf("shape"), axes(appearance).rootNames())
        assertTrue(created.bodyAsText().contains("\"isRoot\":true"))
    }

    @Test
    fun `component configuration create repeats the saved result`() = withService {
        val ds = designSystem()
        importConfig(ds, "default", config(root = null, scheme = null))
        val appearance = appearanceId()
        val component = query("SELECT id FROM components WHERE name = 'Button'")
        val variation = id(
            post(
                "/api/ds/variations",
                """{"designSystemId":"$ds","componentId":"$component","name":"shape"}""",
            ).bodyAsText(),
        )
        val body = """{"appearanceId":"$appearance","variationId":"$variation","position":0}"""

        val first = post("/api/ds/appearance-variations", body, idempotencyKey = "axis-create")
        val replay = post("/api/ds/appearance-variations", body, idempotencyKey = "axis-create")
        val mismatch = post(
            "/api/ds/appearance-variations",
            """{"appearanceId":"$appearance","variationId":"$variation","position":1}""",
            idempotencyKey = "axis-create",
        )

        assertEquals(HttpStatusCode.Created, first.status, first.bodyAsText())
        assertEquals(HttpStatusCode.Created, replay.status, replay.bodyAsText())
        assertEquals(first.bodyAsText(), replay.bodyAsText())
        assertEquals(HttpStatusCode.Conflict, mismatch.status, mismatch.bodyAsText())
        assertEquals("1", query("SELECT count(*) FROM appearance_variations WHERE appearance_id = '$appearance'"))
    }

    // ── fixtures ───────────────────────────────────────────────────────────────────────────────────

    private suspend fun designSystem(): String {
        val ds =
            id(post("/api/ds/design-systems", """{"name":"alpha","projectName":"alpha"}""", owner = true).bodyAsText())
        post("/api/ds/components", """{"name":"Button","platform":"compose"}""")
        post(
            "/api/ds/design-system-versions",
            """{"designSystemId":"$ds","version":"1.0.0","snapshot":{},"publicationStatus":"published"}""",
            owner = true,
        )
        return ds
    }

    private fun config(root: String?, scheme: String?, vararg axes: String): String {
        val variations = axes.joinToString(",") { axis ->
            """{"id":"$axis","name":"$axis","values":[{"name":"a","properties":{}},{"name":"b","properties":{}}]}"""
        }
        val head = listOfNotNull(
            root?.let { "\"rootVariationId\":\"$it\"" },
            scheme?.let { "\"colorSchemeVariationId\":\"$it\"" },
        ).joinToString(",").let { if (it.isEmpty()) "" else "$it," }
        return """{$head"invariants":{},"variations":[$variations]}"""
    }

    private suspend fun importConfig(ds: String, style: String, config: String): HttpResponse = post(
        "/api/ds/component-config/import",
        """
        {"designSystemId":"$ds","platform":"compose","meta":{"name":"fixture","source":"kotlin-test"},"dryRun":false,
         "components":[{"componentName":"button","styleName":"$style","config":$config}]}
        """.trimIndent(),
        editor = true,
    )

    private suspend fun exported(ds: String, style: String): JsonObject {
        val response = post(
            "/api/ds/component-config/export",
            """{"designSystemId":"$ds","platform":"compose"}""",
            viewer = true,
        )
        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        return json.parseToJsonElement(response.bodyAsText()).jsonObject.getValue("components").jsonArray
            .map { it.jsonObject }.single { it.getValue("styleName").jsonPrimitive.content == style }
            .getValue("config").jsonObject
    }

    private suspend fun axes(appearance: String): List<JsonObject> {
        val response = get("/api/ds/appearances/$appearance/variations")
        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        return json.parseToJsonElement(response.bodyAsText()).jsonArray.map { it.jsonObject }
    }

    private fun List<JsonObject>.rootNames() = namesWhere("isRoot")

    private fun List<JsonObject>.schemeNames() = namesWhere("isColorScheme")

    private fun List<JsonObject>.namesWhere(flag: String): Set<String> =
        filter { it.getValue(flag).jsonPrimitive.content.toBoolean() }
            .map { variationName(it.getValue("variationId").jsonPrimitive.content) }.toSet()

    private fun List<JsonObject>.axisId(name: String): String =
        single { variationName(it.getValue("variationId").jsonPrimitive.content) == name }
            .getValue("id").jsonPrimitive.content

    private fun variationName(id: String) =
        query("SELECT name FROM $RESOLVED_VARIATIONS_TEST_SQL variations WHERE id = '$id'")

    private fun appearanceId() = query("SELECT appearance_id FROM ($RESOLVED_APPEARANCES) resolved")

    private fun colorSchemeAxisCount() = query(
        "WITH resolved_appearances AS ($RESOLVED_APPEARANCES), " +
            "resolved_axes AS ($RESOLVED_APPEARANCE_VARIATIONS) " +
            "SELECT count(*) FROM resolved_axes axis " +
            "JOIN appearance_variations entity ON entity.id = axis.appearance_variation_id " +
            "JOIN resolved_appearances appearance ON appearance.appearance_id = entity.appearance_id " +
            "WHERE entity.variation_id = appearance.color_scheme_variation_id",
    )

    private fun editRevision(entityType: String, entityId: String): Long = query(
        "SELECT revision FROM entity_edit_states " +
            "WHERE entity_type = '$entityType' AND entity_id = '$entityId'",
    ).toLong()

    private fun latestPaths(entityType: String, entityId: String, revision: Long): String = query(
        "SELECT string_agg(path, ',' ORDER BY path) FROM entity_edit_paths " +
            "WHERE entity_type = '$entityType' AND entity_id = '$entityId' AND last_revision = $revision",
    )

    private fun JsonObject.string(name: String): String? = getValue(name).let {
        if (it is JsonNull) null else it.jsonPrimitive.content
    }

    // ── harness ────────────────────────────────────────────────────────────────────────────────────

    private class Service(val postgres: IsolatedPostgresDatabase, val builder: ApplicationTestBuilder)

    private lateinit var service: Service

    private fun withService(body: suspend AppearanceAxisRolesHttpPostgresIntegrationTest.() -> Unit) {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                service = Service(postgres, this)
                kotlinx.coroutines.runBlocking { body() }
            }
        }
    }

    private suspend fun post(
        path: String,
        body: String,
        owner: Boolean = false,
        editor: Boolean = false,
        viewer: Boolean = false,
        idempotencyKey: String? = null,
    ) = service.builder.client.post(path) {
        actor(admin = !owner && !editor && !viewer, owner = owner, editor = editor, viewer = viewer)
        idempotencyKey?.let { header("Idempotency-Key", it) }
        contentType(ContentType.Application.Json)
        setBody(body)
    }

    private suspend fun patch(path: String, body: String, baseRevision: Long? = null) =
        service.builder.client.patch(path) {
            actor(admin = true, owner = false, editor = false, viewer = false)
            baseRevision?.let { header("X-DS-Base-Revision", it) }
            contentType(ContentType.Application.Json)
            setBody(body)
        }

    private suspend fun delete(path: String) = service.builder.client.delete(path) {
        actor(admin = true, owner = false, editor = false, viewer = false)
    }

    private suspend fun get(path: String) = service.builder.client.get(path) {
        actor(admin = true, owner = false, editor = false, viewer = false)
    }

    private fun HttpRequestBuilder.actor(admin: Boolean, owner: Boolean, editor: Boolean, viewer: Boolean) {
        val role = when {
            owner -> "owner"
            editor -> "editor"
            viewer -> "viewer"
            else -> "viewer"
        }
        header("X-Actor-Type", "user")
        header("X-User-Id", if (admin) "integration-admin" else "integration-user")
        header("X-Project-Id", if (admin) "global" else "project-a")
        if (!admin) header("X-Project-Role", role)
        header("X-System-Admin", admin.toString())
    }

    private fun configuration(postgres: IsolatedPostgresDatabase) = DsServiceConfiguration(
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
    )

    private fun id(body: String): String = json.parseToJsonElement(body).jsonObject.getValue("id").jsonPrimitive.content

    private fun query(sql: String): String =
        DriverManager.getConnection(
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

    private fun execute(sql: String) {
        DriverManager.getConnection(
            service.postgres.jdbcUrl,
            service.postgres.username,
            service.postgres.password,
        ).use {
            it.createStatement().use { statement -> statement.execute(sql) }
        }
    }

    private companion object {
        const val RESOLVED_APPEARANCES =
            "SELECT * FROM (SELECT DISTINCT ON (appearance_id) * FROM appearance_revisions " +
                "ORDER BY appearance_id, version_sequence_number DESC) latest WHERE NOT deleted"
        const val RESOLVED_APPEARANCE_VARIATIONS =
            "SELECT * FROM (SELECT DISTINCT ON (appearance_variation_id) * FROM appearance_variation_revisions " +
                "ORDER BY appearance_variation_id, version_sequence_number DESC) latest WHERE NOT deleted"
    }
}
