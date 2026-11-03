package com.dsbuilder.ds.app

import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.get
import io.ktor.client.request.header
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
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.sql.DriverManager
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

/**
 * `GET /api/ds/design-systems/{id}/components/{componentId}/editor-bundle`: каждое поле совпадает
 * с ответом существующего маршрута, ограниченным компонентом, его свойствами и дизайн-системой.
 */
class ComponentEditorBundleHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `a web bundle equals the existing routes filtered to the component`() = withService {
        val fixture = fixture()
        val bundle = bundle(fixture.alpha, fixture.webButton, "web")

        assertBundleMatchesRoutes(bundle, fixture.alpha, fixture.webButton, "web")
        assertEquals(2, bundle.list("properties").size)
        assertEquals(2, bundle.list("platformParams").size)
        assertEquals(1, bundle.list("propertyVariations").size)
        assertEquals(1, bundle.list("appearances").size)
        assertTrue(bundle.list("styles").isNotEmpty())
        assertEquals("Button", bundle.getValue("webAdapter").jsonObject.string("name"))
        assertEquals(3, bundle.list("dependencies").size)
        // Icon привязан к alpha и web; Other привязан только к beta, Badge другой платформы.
        assertEquals(listOf(fixture.webIcon), bundle.list("dependencyComponents").map { it.string("id") })
    }

    @Test
    fun `a compose bundle exports compose and has no property variations and web adapter`() = withService {
        val fixture = fixture()
        val bundle = bundle(fixture.alpha, fixture.composeButton, "compose")

        assertBundleMatchesRoutes(bundle, fixture.alpha, fixture.composeButton, "compose")
        assertEquals(JsonNull, bundle.getValue("webAdapter"))
        assertTrue(bundle.list("propertyVariations").isEmpty())
        assertEquals(1, bundle.list("platformParams").size)
        val exported = bundle.getValue("export").jsonObject.getValue("components").jsonArray
        assertEquals(listOf("button"), exported.map { it.jsonObject.string("componentName") })
        assertEquals(listOf(fixture.composeBadge), bundle.list("dependencyComponents").map { it.string("id") })
    }

    @Test
    fun `unlinked components foreign platforms invalid platforms and missing scopes are rejected`() = withService {
        val fixture = fixture()
        val path = "/api/ds/design-systems/${fixture.alpha}/components"

        assertEquals(HttpStatusCode.NotFound, get("$path/${fixture.webOther}/editor-bundle?platform=web").status)
        assertEquals(HttpStatusCode.NotFound, get("$path/${fixture.composeButton}/editor-bundle?platform=web").status)
        assertEquals(HttpStatusCode.NotFound, get("$path/${fixture.webButton}/editor-bundle?platform=compose").status)
        val foreignProject = service.builder.client.get("$path/${fixture.webButton}/editor-bundle?platform=web") {
            user(project = "project-b", role = "viewer")
        }
        assertEquals(HttpStatusCode.NotFound, foreignProject.status)
        assertEquals(HttpStatusCode.BadRequest, get("$path/${fixture.webButton}/editor-bundle?platform=ios").status)
        assertEquals(HttpStatusCode.BadRequest, get("$path/${fixture.webButton}/editor-bundle").status)
        assertEquals(HttpStatusCode.BadRequest, get("$path/not-a-uuid/editor-bundle?platform=web").status)

        val withoutScope = service.builder.client.get("$path/${fixture.webButton}/editor-bundle?platform=web") {
            header("X-Actor-Type", "project_key")
            header("X-Project-Key-Id", "key-1")
            header("X-Project-Id", "project-a")
            header("X-Project-Scopes", "components:read")
        }
        assertEquals(HttpStatusCode.Forbidden, withoutScope.status)
    }

    @Test
    fun `a published version is read like the existing routes with the same version`() = withService {
        val fixture = fixture()
        publish(fixture.alpha)
        val version = query(
            "SELECT id::text FROM design_system_versions " +
                "WHERE design_system_id = '${fixture.alpha}' AND status = 'published'",
        )
        imported(importBody(fixture.alpha, "web", "button", "secondary", config("shape", listOf("x"))))

        val current = bundle(fixture.alpha, fixture.webButton, "web")
        val published = bundle(fixture.alpha, fixture.webButton, "web", version)

        assertBundleMatchesRoutes(published, fixture.alpha, fixture.webButton, "web", version)
        assertBundleMatchesRoutes(current, fixture.alpha, fixture.webButton, "web")
        assertEquals(1, published.list("appearances").size)
        assertEquals(2, current.list("appearances").size)
        assertNotEquals(published.list("variations").size, current.list("variations").size)
        assertNotEquals(published.getValue("export"), current.getValue("export"))
    }

    // ── сравнение с существующими маршрутами ───────────────────────────────────────────────────────

    @Suppress("LongMethod")
    private suspend fun assertBundleMatchesRoutes(
        bundle: JsonObject,
        ds: String,
        component: String,
        platform: String,
        version: String? = null,
    ) {
        val v = version?.let { "versionId=$it" }
        fun withVersion(path: String) = v?.let { if ('?' in path) "$path&$it" else "$path?$it" } ?: path

        val componentRow = read(withVersion("/api/ds/components/$component")).jsonObject
        assertEquals(componentRow, bundle.getValue("component"))

        val appearances = read(withVersion("/api/ds/appearances")).objects()
            .filter { it.string("designSystemId") == ds && it.string("componentId") == component }
        assertEquals(appearances.byId(), bundle.list("appearances").byId())

        val names = """["${componentRow.string("name").lowercase()}"]"""
        val export = readPost(
            withVersion("/api/ds/component-config/export"),
            """{"designSystemId":"$ds","platform":"$platform","components":$names}""",
        )
        assertEquals(export, bundle.getValue("export"))

        val properties = read(withVersion("/api/ds/components/$component/properties")).objects()
        assertEquals(properties.byId(), bundle.list("properties").byId())
        val propertyIds = properties.map { it.string("id") }.toSet()

        val params = read(withVersion("/api/ds/property-platform-params")).objects()
            .filter { it.string("propertyId") in propertyIds }
        assertEquals(params.byId(), bundle.list("platformParams").byId())

        val propertyVariations = if (platform == "web") {
            read(withVersion("/api/ds/property-variations")).objects().filter { it.string("propertyId") in propertyIds }
        } else {
            emptyList()
        }
        assertEquals(propertyVariations.byId(), bundle.list("propertyVariations").byId())

        val variations = read(withVersion("/api/ds/components/$component/variations?designSystemId=$ds")).objects()
        assertEquals(variations.byId(), bundle.list("variations").byId())

        val styles = read(withVersion("/api/ds/design-systems/$ds/components/$component/styles")).objects()
        assertEquals(styles.byId(), bundle.list("styles").byId())

        val adapter: JsonElement = if (platform == "web") {
            readPost(withVersion("/api/ds/component-config/web-adapter"), """{"designSystemId":"$ds"}""")
                .jsonArray.map { it.jsonObject }.firstOrNull { it.string("name") == componentRow.string("name") }
                ?: JsonNull
        } else {
            JsonNull
        }
        assertEquals(adapter, bundle.getValue("webAdapter"))

        val dependencies = read(withVersion("/api/ds/component-deps")).objects()
            .filter { it.string("parentId") == component || it.string("childId") == component }
        assertEquals(dependencies.byId(), bundle.list("dependencies").byId())

        val linked = read(withVersion("/api/ds/design-system-components")).objects()
            .filter { it.string("designSystemId") == ds }
            .map { it.string("componentId") }.toSet()
        val otherIds = dependencies.flatMap { listOf(it.string("parentId"), it.string("childId")) }
            .filter { it != component }.toSet()
        val dependencyComponents = read(withVersion("/api/ds/components")).objects().filter {
            it.string("id") in otherIds && it.string("id") in linked && it.string("platform") == platform
        }
        assertEquals(dependencyComponents.byId(), bundle.list("dependencyComponents").byId())
    }

    // ── фикстуры ───────────────────────────────────────────────────────────────────────────────────

    private class Fixture(
        val alpha: String,
        val webButton: String,
        val webIcon: String,
        val webOther: String,
        val composeButton: String,
        val composeBadge: String,
    )

    @Suppress("LongMethod")
    private suspend fun fixture(): Fixture {
        val alpha = designSystem("alpha")
        val beta = designSystem("beta")
        val webButton = component("Button", "web")
        val webIcon = component("Icon", "web")
        val webOther = component("Other", "web")
        val composeButton = component("Button", "compose")
        val composeBadge = component("Badge", "compose")

        imported(importBody(alpha, "web", "button", "default", config("size", listOf("s", "m"))))
        imported(importBody(alpha, "web", "icon", "default", config("size", listOf("s"))))
        imported(importBody(beta, "web", "button", "default", config("tone", listOf("a"))))
        // Other читается проектом, но привязан только к beta.
        imported(importBody(beta, "web", "other", "default", config("tone", listOf("a"))))
        imported(importBody(alpha, "compose", "button", "default", config("size", listOf("s", "m"))))
        imported(importBody(alpha, "compose", "badge", "default", config("size", listOf("s"))))

        val padding = property(webButton, "padding", "dimension")
        val fill = property(webButton, "fill", "color")
        property(webIcon, "glyph", "value")
        val composePadding = property(composeButton, "padding", "dimension")
        created("/api/ds/property-platform-params", """{"propertyId":"$padding","platform":"web","name":"padding"}""")
        created("/api/ds/property-platform-params", """{"propertyId":"$fill","platform":"web","name":"background"}""")
        created(
            "/api/ds/property-platform-params",
            """{"propertyId":"$composePadding","platform":"compose","name":"paddingValues"}""",
        )
        val size = read("/api/ds/components/$webButton/variations?designSystemId=$alpha").objects()
            .single { it.string("name") == "size" }.string("id")
        created("/api/ds/property-variations", """{"propertyId":"$padding","variationId":"$size"}""")

        created("/api/ds/component-deps", """{"parentId":"$webButton","childId":"$webIcon","type":"compose"}""")
        created("/api/ds/component-deps", """{"parentId":"$webOther","childId":"$webButton","type":"reuse"}""")
        created("/api/ds/component-deps", """{"parentId":"$webButton","childId":"$composeBadge","type":"reuse"}""")
        created(
            "/api/ds/component-deps",
            """{"parentId":"$composeButton","childId":"$composeBadge","type":"compose","order":0}""",
        )
        return Fixture(alpha, webButton, webIcon, webOther, composeButton, composeBadge)
    }

    private suspend fun designSystem(name: String): String = id(
        created("/api/ds/design-systems", """{"name":"$name","projectName":"$name"}""", admin = false),
    )

    private suspend fun component(name: String, platform: String): String =
        id(created("/api/ds/components", """{"name":"$name","platform":"$platform"}""", admin = true))

    private suspend fun property(component: String, name: String, type: String): String =
        id(
            created(
                "/api/ds/properties",
                """{"componentId":"$component","name":"$name","type":"$type"}""",
                admin = true,
            ),
        )

    private fun config(axis: String, values: List<String>): String {
        val axisValues = values.joinToString(",") { """{"name":"$it","properties":{}}""" }
        return """{"colorSchemeVariationId":"view","invariants":{},"variations":[
            {"id":"view","name":"view","values":[{"name":"default","properties":{}}]},
            {"id":"$axis","name":"$axis","values":[$axisValues]}]}"""
    }

    private fun importBody(ds: String, platform: String, component: String, style: String, config: String) =
        """{"designSystemId":"$ds","platform":"$platform","meta":{"name":"fixture","source":"kotlin-test"},
           "dryRun":false,"components":[{"componentName":"$component","styleName":"$style","config":$config}]}"""

    private suspend fun imported(body: String) {
        val response = post("/api/ds/component-config/import", body, admin = true)
        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        val rejected = json.parseToJsonElement(response.bodyAsText()).jsonObject["rejected"]?.jsonArray.orEmpty()
        assertTrue(rejected.isEmpty(), response.bodyAsText())
    }

    private suspend fun publish(ds: String) {
        val draft = "SELECT %s FROM design_system_versions WHERE design_system_id = '$ds' AND status = 'draft'"
        val response = post(
            "/api/ds/design-system-versions",
            """{"designSystemId":"$ds","draftId":"${query(draft.format("id::text"))}",""" +
                """"draftRevision":${query(draft.format("resolved_draft_revision(id)::text"))},""" +
                """"version":"2.0.0","changelog":"fixture"}""",
            role = "owner",
            key = "publish-$ds",
        )
        assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
    }

    // ── чтение ответов ─────────────────────────────────────────────────────────────────────────────

    private suspend fun bundle(ds: String, component: String, platform: String, version: String? = null): JsonObject {
        val suffix = version?.let { "&versionId=$it" }.orEmpty()
        val response = get("/api/ds/design-systems/$ds/components/$component/editor-bundle?platform=$platform$suffix")
        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        val body = json.parseToJsonElement(response.bodyAsText()).jsonObject
        assertEquals(EXPECTED_FIELDS, body.keys)
        return body
    }

    private suspend fun read(path: String): JsonElement {
        val response = get(path)
        assertEquals(HttpStatusCode.OK, response.status, "$path: ${response.bodyAsText()}")
        return json.parseToJsonElement(response.bodyAsText())
    }

    private suspend fun readPost(path: String, body: String): JsonElement {
        val response = post(path, body)
        assertEquals(HttpStatusCode.OK, response.status, "$path: ${response.bodyAsText()}")
        return json.parseToJsonElement(response.bodyAsText())
    }

    private suspend fun created(path: String, body: String, admin: Boolean = true): String {
        val response = post(path, body, admin = admin, role = "owner")
        assertEquals(HttpStatusCode.Created, response.status, "$path: ${response.bodyAsText()}")
        return response.bodyAsText()
    }

    private fun JsonElement.objects(): List<JsonObject> = jsonArray.map { it.jsonObject }

    private fun JsonObject.list(name: String): List<JsonObject> = getValue(name).jsonArray.map { it.jsonObject }

    private fun List<JsonObject>.byId(): List<JsonObject> = sortedBy { it.string("id") }

    private fun JsonObject.string(name: String): String =
        getValue(name).let { if (it is JsonNull) "" else it.jsonPrimitive.content }

    private fun id(body: String): String = json.parseToJsonElement(body).jsonObject.string("id")

    // ── harness ────────────────────────────────────────────────────────────────────────────────────

    private class Service(val postgres: IsolatedPostgresDatabase, val builder: ApplicationTestBuilder)

    private lateinit var service: Service

    private fun withService(body: suspend ComponentEditorBundleHttpPostgresIntegrationTest.() -> Unit) {
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
        role: String = "viewer",
        key: String? = null,
    ): HttpResponse = service.builder.client.post(path) {
        if (admin) admin() else user(role = role)
        key?.let { header("Idempotency-Key", it) }
        contentType(ContentType.Application.Json)
        setBody(body)
    }

    private suspend fun get(path: String): HttpResponse = service.builder.client.get(path) { user(role = "viewer") }

    private fun HttpRequestBuilder.admin() {
        header("X-Actor-Type", "user")
        header("X-User-Id", "integration-admin")
        header("X-Project-Id", "global")
        header("X-System-Admin", "true")
    }

    private fun HttpRequestBuilder.user(project: String = "project-a", role: String) {
        header("X-Actor-Type", "user")
        header("X-User-Id", "integration-user")
        header("X-Project-Id", project)
        header("X-Project-Role", role)
        header("X-System-Admin", "false")
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
        val EXPECTED_FIELDS = setOf(
            "component",
            "appearances",
            "export",
            "properties",
            "platformParams",
            "propertyVariations",
            "variations",
            "styles",
            "webAdapter",
            "dependencies",
            "dependencyComponents",
        )
    }
}
