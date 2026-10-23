package com.dsbuilder.ds.app

import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.sql.DriverManager
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

/** Оси вариации принадлежат дизайн-системе: изоляция, права, конфликт имён и версионирование в черновике. */
class VariationAxesHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = false }

    @Test
    fun `two design systems own separate axes of one component and editing one leaves the other`() = withService {
        val component = component("Button")
        val systemA = designSystem("alpha", component)
        val systemB = designSystem("beta", component)
        val sizeA = createAxis(systemA, component, "size")
        val sizeB = createAxis(systemB, component, "size")
        assertNotEquals(sizeA, sizeB)

        assertEquals(listOf(sizeA), axisIds(component, systemA))
        assertEquals(listOf(sizeB), axisIds(component, systemB))
        assertEquals(setOf(sizeA, sizeB), axisIds(component, null).toSet())
        assertEquals(systemA, field(adminGet("/api/ds/variations/$sizeA").bodyAsText(), "designSystemId"))

        // Структуру второй системы меняют независимо: переименование и вторая ось не видны в первой.
        val renamed = patch("/api/ds/variations/$sizeB", """{"name":"scale"}""")
        assertEquals(HttpStatusCode.OK, renamed.status, renamed.bodyAsText())
        createAxis(systemB, component, "shape")
        assertEquals(listOf("size"), axisNames(component, systemA))
        assertEquals(setOf("scale", "shape"), axisNames(component, systemB).toSet())
    }

    @Test
    fun `axis creation validates the design system the name and the component link`() = withService {
        val component = component("Button")
        val other = component("Badge")
        val system = designSystem("alpha", component)

        val withoutSystem = post("/api/ds/variations", """{"componentId":"$component","name":"size"}""", admin = true)
        assertEquals(HttpStatusCode.BadRequest, withoutSystem.status, withoutSystem.bodyAsText())
        createAxis(system, component, "size")
        val duplicate = post(
            "/api/ds/variations",
            """{"designSystemId":"$system","componentId":"$component","name":"size"}""",
            admin = true,
        )
        assertEquals(HttpStatusCode.Conflict, duplicate.status, duplicate.bodyAsText())
        val unlinked = post(
            "/api/ds/variations",
            """{"designSystemId":"$system","componentId":"$other","name":"size"}""",
            admin = true,
        )
        assertEquals(HttpStatusCode.NotFound, unlinked.status, unlinked.bodyAsText())
        val taken = createAxis(system, component, "shape")
        val clash = patch("/api/ds/variations/$taken", """{"name":"size"}""")
        assertEquals(HttpStatusCode.Conflict, clash.status, clash.bodyAsText())
    }

    @Test
    fun `a project owner renames an axis of the own design system and a viewer cannot`() = withService {
        val component = component("Button")
        val system = designSystem("alpha", component)
        val axis = createAxis(system, component, "size")

        createAxis(system, component, "shape")
        val denied = patch("/api/ds/variations/$axis", """{"name":"shape"}""", admin = false, viewer = true)
        assertTrue(
            denied.status == HttpStatusCode.Forbidden || denied.status == HttpStatusCode.NotFound,
            denied.bodyAsText(),
        )
        assertEquals(setOf("size", "shape"), axisNames(component, system).toSet())

        val allowed = patch("/api/ds/variations/$axis", """{"name":"scale"}""", admin = false, owner = true)
        assertEquals(HttpStatusCode.OK, allowed.status, allowed.bodyAsText())
        assertEquals(setOf("scale", "shape"), axisNames(component, system).toSet())
    }

    @Test
    fun `an axis rename is a draft revision and the published version keeps the old name`() = withService {
        val component = component("Button")
        val system = designSystem("alpha", component)
        val axis = createAxis(system, component, "size")
        val versionId = publish(system)

        val renamed = patch("/api/ds/variations/$axis", """{"name":"scale"}""")
        assertEquals(HttpStatusCode.OK, renamed.status, renamed.bodyAsText())

        assertEquals("scale", field(adminGet("/api/ds/variations/$axis").bodyAsText(), "name"))
        assertEquals("size", field(adminGet("/api/ds/variations/$axis?versionId=$versionId").bodyAsText(), "name"))
        assertEquals("2", query("SELECT count(*) FROM variation_revisions WHERE variation_id = '$axis'"))
    }

    @Test
    fun `a created axis is a journal change and reverting it removes the axis`() = withService {
        val component = component("Button")
        val system = designSystem("alpha", component)
        val axis = createAxis(system, component, "size")

        val journal = json.parseToJsonElement(get("/api/ds/design-systems/$system/changes").bodyAsText()).jsonArray
        val change = journal.map { it.jsonObject }.first { it["entityId"]?.jsonPrimitive?.content == axis }
        assertEquals("variation", change.getValue("entityType").jsonPrimitive.content)
        assertEquals("created", change.getValue("operation").jsonPrimitive.content.lowercase())

        val reverted = post(
            "/api/ds/design-systems/$system/changes/${change.getValue("changeId").jsonPrimitive.content}/revert",
            "{}",
            owner = true,
            idempotencyKey = "variation-axis-revert",
            baseRevision = change.getValue("editRevision").jsonPrimitive.content,
        )
        assertEquals(HttpStatusCode.OK, reverted.status, reverted.bodyAsText())
        assertEquals(emptyList(), axisIds(component, system))
        assertEquals("0", query("SELECT count(*) FROM variations WHERE id = '$axis'"))
    }

    @Test
    fun `reverting an axis rename restores the previous name`() = withService {
        val component = component("Button")
        val system = designSystem("alpha", component)
        val axis = createAxis(system, component, "size")
        publish(system)
        assertEquals(HttpStatusCode.OK, patch("/api/ds/variations/$axis", """{"name":"scale"}""").status)
        assertEquals(listOf("scale"), axisNames(component, system))

        val journal = json.parseToJsonElement(get("/api/ds/design-systems/$system/changes").bodyAsText()).jsonArray
        val change = journal.map { it.jsonObject }.first { it["entityId"]?.jsonPrimitive?.content == axis }
        val reverted = post(
            "/api/ds/design-systems/$system/changes/${change.getValue("changeId").jsonPrimitive.content}/revert",
            "{}",
            owner = true,
            idempotencyKey = "variation-rename-revert",
            baseRevision = change.getValue("editRevision").jsonPrimitive.content,
        )
        assertEquals(HttpStatusCode.OK, reverted.status, reverted.bodyAsText())
        assertEquals(listOf("size"), axisNames(component, system))
    }

    @Test
    fun `reverting an axis creation is rejected while a style still uses the axis`() = withService {
        val component = component("Button")
        val system = designSystem("alpha", component)
        val axis = createAxis(system, component, "size")
        val style = post(
            "/api/ds/styles",
            """{"designSystemId":"$system","variationId":"$axis","name":"m"}""",
            admin = true,
        )
        assertEquals(HttpStatusCode.Created, style.status, style.bodyAsText())

        val journal = json.parseToJsonElement(get("/api/ds/design-systems/$system/changes").bodyAsText()).jsonArray
        val change = journal.map { it.jsonObject }.first { it["entityId"]?.jsonPrimitive?.content == axis }
        val reverted = post(
            "/api/ds/design-systems/$system/changes/${change.getValue("changeId").jsonPrimitive.content}/revert",
            "{}",
            owner = true,
            idempotencyKey = "variation-axis-revert-conflict",
            baseRevision = change.getValue("editRevision").jsonPrimitive.content,
        )
        assertEquals(HttpStatusCode.Conflict, reverted.status, reverted.bodyAsText())
        assertEquals(listOf(axis), axisIds(component, system))
    }

    @Test
    fun `two design systems importing the same axis get separate records`() = withService {
        val component = component("Button")
        val systemA = designSystem("alpha", component)
        val systemB = designSystem("beta", component)
        listOf(systemA, systemB).forEach { system ->
            val imported = post(
                "/api/ds/component-config/import",
                """{"designSystemId":"$system","platform":"web","meta":{"name":"fixture","source":"kotlin-test"},""" +
                    """"dryRun":false,"components":[{"componentName":"Button","styleName":"default","config":""" +
                    """{"invariants":{},"variations":[{"id":"size","name":"size","values":[{"name":"m"}]}]}}]}""",
                editor = true,
            )
            assertEquals(HttpStatusCode.OK, imported.status, imported.bodyAsText())
        }
        val idsA = axisIds(component, systemA)
        val idsB = axisIds(component, systemB)
        assertEquals(1, idsA.size)
        assertEquals(1, idsB.size)
        assertNotEquals(idsA.single(), idsB.single())
        assertEquals("1", query("SELECT count(*) FROM variations WHERE design_system_id = '$systemA'"))
        assertEquals("1", query("SELECT count(*) FROM variations WHERE design_system_id = '$systemB'"))
        assertEquals(
            "0",
            query(
                "SELECT count(*) FROM property_variations link JOIN variations axis ON axis.id = link.variation_id " +
                    "WHERE link.design_system_id <> axis.design_system_id",
            ),
        )
    }

    @Test
    fun `a project owner manages axes of the own design system although the component is shared with a foreign one`() =
        withService {
            val component = component("Button")
            val own = designSystem("alpha", component)
            val foreign = id(
                post("/api/ds/design-systems", """{"name":"base","projectName":"base"}""", admin = true).bodyAsText(),
            )
            val linked = post(
                "/api/ds/design-system-components",
                """{"designSystemId":"$foreign","componentId":"$component"}""",
                admin = true,
            )
            assertEquals(HttpStatusCode.Created, linked.status, linked.bodyAsText())
            val foreignAxis = createAxis(foreign, component, "size")

            val created = post(
                "/api/ds/variations",
                """{"designSystemId":"$own","componentId":"$component","name":"size"}""",
                owner = true,
            )
            assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
            val ownAxis = id(created.bodyAsText())
            val renamed = patch("/api/ds/variations/$ownAxis", """{"name":"scale"}""", admin = false, owner = true)
            assertEquals(HttpStatusCode.OK, renamed.status, renamed.bodyAsText())

            val denied = patch("/api/ds/variations/$foreignAxis", """{"name":"scale"}""", admin = false, owner = true)
            assertTrue(
                denied.status == HttpStatusCode.Forbidden || denied.status == HttpStatusCode.NotFound,
                denied.bodyAsText(),
            )
            val deniedCreate = post(
                "/api/ds/variations",
                """{"designSystemId":"$foreign","componentId":"$component","name":"shape"}""",
                owner = true,
            )
            assertEquals(HttpStatusCode.NotFound, deniedCreate.status, deniedCreate.bodyAsText())
        }

    // ── fixtures ───────────────────────────────────────────────────────────────────────────────────

    private suspend fun component(name: String): String =
        id(post("/api/ds/components", """{"name":"$name","platform":"web"}""", admin = true).bodyAsText())

    /** Публикует активный черновик системы и возвращает идентификатор опубликованной версии. */
    private suspend fun publish(system: String): String {
        val draft = json.parseToJsonElement(get("/api/ds/design-systems/$system").bodyAsText()).jsonObject
        val published = post(
            "/api/ds/design-system-versions",
            """{"designSystemId":"$system","draftId":${draft.getValue("draftId")},""" +
                """"draftRevision":${draft.getValue("draftRevision")},"version":"1.0.0"}""",
            owner = true,
            idempotencyKey = "variation-axes-publication-$system",
        )
        assertEquals(HttpStatusCode.Created, published.status, published.bodyAsText())
        return id(published.bodyAsText())
    }

    private suspend fun adminGet(path: String) = get(path, viewer = false, admin = true)

    private suspend fun designSystem(name: String, component: String): String {
        val system = id(
            post("/api/ds/design-systems", """{"name":"$name","projectName":"$name"}""", owner = true).bodyAsText(),
        )
        val linked = post(
            "/api/ds/design-system-components",
            """{"designSystemId":"$system","componentId":"$component"}""",
            admin = true,
        )
        assertEquals(HttpStatusCode.Created, linked.status, linked.bodyAsText())
        return system
    }

    private suspend fun createAxis(system: String, component: String, name: String): String {
        val created = post(
            "/api/ds/variations",
            """{"designSystemId":"$system","componentId":"$component","name":"$name"}""",
            admin = true,
        )
        assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
        return id(created.bodyAsText())
    }

    private suspend fun axes(component: String, system: String?) = json.parseToJsonElement(
        get(
            "/api/ds/components/$component/variations" + (system?.let { "?designSystemId=$it" } ?: ""),
            viewer = false,
            admin = true,
        ).bodyAsText(),
    ).jsonArray.map { it.jsonObject }

    private suspend fun axisIds(component: String, system: String?) =
        axes(component, system).map { it.getValue("id").jsonPrimitive.content }

    private suspend fun axisNames(component: String, system: String?) =
        axes(component, system).map { it.getValue("name").jsonPrimitive.content }

    // ── harness ────────────────────────────────────────────────────────────────────────────────────

    private class Service(val postgres: IsolatedPostgresDatabase, val builder: ApplicationTestBuilder)

    private lateinit var service: Service

    private fun withService(body: suspend VariationAxesHttpPostgresIntegrationTest.() -> Unit) {
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
        admin: Boolean = false,
        owner: Boolean = false,
        editor: Boolean = false,
        viewer: Boolean = false,
        idempotencyKey: String? = null,
        baseRevision: String? = null,
    ) = service.builder.client.post(path) {
        actor(admin, owner, editor, viewer)
        baseRevision?.let { header("X-DS-Base-Revision", it) }
        idempotencyKey?.let { header("Idempotency-Key", it) }
        contentType(ContentType.Application.Json)
        setBody(body)
    }

    private suspend fun patch(
        path: String,
        body: String,
        admin: Boolean = true,
        owner: Boolean = false,
        viewer: Boolean = false,
    ) = service.builder.client.patch(path) {
        actor(admin = admin, owner = owner, editor = false, viewer = viewer)
        contentType(ContentType.Application.Json)
        setBody(body)
    }

    private suspend fun get(path: String, viewer: Boolean = true, admin: Boolean = false) =
        service.builder.client.get(path) {
            actor(admin = admin, owner = false, editor = false, viewer = viewer)
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

    private fun id(body: String): String = field(body, "id")

    private fun field(body: String, name: String): String =
        json.parseToJsonElement(
            body,
        ).jsonObject.getValue(name).let { if (it is JsonNull) "null" else it.jsonPrimitive.content }

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
}
