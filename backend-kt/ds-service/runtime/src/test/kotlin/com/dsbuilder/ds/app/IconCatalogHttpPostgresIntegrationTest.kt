@file:Suppress("ktlint:standard:max-line-length")

package com.dsbuilder.ds.app

import com.dsbuilder.ds.components.application.IconAssetStorage
import com.dsbuilder.ds.components.application.StoredIconLoad
import com.dsbuilder.ds.components.domain.IconAsset
import com.dsbuilder.ds.components.domain.IconCatalogLoadId
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.sql.DriverManager
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Каталог иконок (change add-icon-catalog): права, запись и откат, защита используемых иконок, чтение с `ETag` и
 * проверка значения `icon` при записи из редактора.
 */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class IconCatalogHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = true }
    private lateinit var postgres: IsolatedPostgresDatabase
    private lateinit var builder: ApplicationTestBuilder
    private lateinit var storage: InMemoryIconStorage

    private enum class Actor { PUBLISHER, ADMIN, MEMBER }

    @Test
    fun `an environment without a catalog reads empty and accepts any icon value`() = withService {
        val empty = read()
        assertEquals(HttpStatusCode.OK, empty.status)
        val body = json.parseToJsonElement(empty.bodyAsText()).jsonObject
        assertEquals(0, body.getValue("icons").jsonArray.size)
        assertTrue(body["source"].toString() == "null")
        val fixture = fixture()
        assertEquals(HttpStatusCode.OK, setIcon(fixture, "anything.at.all.99").status)
    }

    @Test
    fun `only a publisher or an administrator uploads and the role is checked before the body`() = withService {
        assertEquals(HttpStatusCode.OK, upload(manifest(add()), Actor.PUBLISHER).status)
        assertEquals(HttpStatusCode.OK, upload(manifest(add()), Actor.ADMIN).status)
        assertEquals(HttpStatusCode.Forbidden, upload(manifest(add()), Actor.MEMBER).status)
        val notJson = builder.client.post(PATH) {
            actor(Actor.MEMBER)
            setBody("not json")
        }
        assertEquals(HttpStatusCode.Forbidden, notJson.status)
        assertEquals(HttpStatusCode.BadRequest, upload("not json", Actor.PUBLISHER).status)
    }

    @Test
    fun `a dry run changes nothing and a publication is atomic and idempotent`() = withService {
        val dry = upload(manifest(add()), Actor.PUBLISHER).ok()
        assertEquals("published", dry.string("outcome"))
        assertEquals(true, dry.getValue("dryRun").jsonPrimitive.content.toBoolean())
        assertEquals(0, count("icons"))
        assertTrue(storage.files.isEmpty())

        val first = upload(manifest(add()), Actor.PUBLISHER, dryRun = false).ok()
        assertEquals("published", first.string("outcome"))
        assertEquals(1, count("icons"))
        assertEquals(1, count("icon_catalog_loads WHERE active"))
        assertEquals(2, storage.files.size)
        assertTrue(storage.files.keys.all { it.startsWith(first.string("loadId") + "/") })

        val again = upload(manifest(add(), version = "9.9.9"), Actor.PUBLISHER, dryRun = false).ok()
        assertEquals("unchanged", again.string("outcome"))
        val puts = storage.puts
        val second = upload(manifest(add(), add("AddFill")), Actor.PUBLISHER, dryRun = false).ok()
        assertEquals("published", second.string("outcome"))
        val back = upload(manifest(add()), Actor.PUBLISHER, dryRun = false).ok()
        assertEquals("activated", back.string("outcome"))
        assertEquals(first.string("loadId"), back.string("loadId"))
        assertEquals(1, count("icons"))
        // the new load uploads every file of its own directory; the activation of the first one uploads nothing
        assertEquals(puts + 4, storage.puts)
    }

    @Test
    fun `the catalog is read by a project member with an etag and a conditional request`() = withService {
        val loaded = upload(
            manifest(add(category = "Actions", aliases = listOf("add", "добавить"))),
            Actor.PUBLISHER,
            false,
        ).ok()
        val response = read(Actor.MEMBER)
        assertEquals(HttpStatusCode.OK, response.status)
        val etag = response.headers[HttpHeaders.ETag]
        assertEquals("\"${loaded.string("loadId")}\"", etag)
        val body = json.parseToJsonElement(response.bodyAsText()).jsonObject
        assertEquals("@salutejs/sdds-icons", body.getValue("source").jsonObject.string("package"))
        assertEquals("$PUBLIC_BASE/icons/${loaded.string("loadId")}", body.string("assetsBaseUrl"))
        val icon = body.getValue("icons").jsonArray.single().jsonObject
        assertEquals("add.outline", icon.string("legacyKey"))
        assertEquals("outline", icon.string("style"))
        assertEquals("Actions", icon.string("category"))
        assertEquals(listOf("16", "24"), icon.getValue("sizes").jsonArray.map { it.jsonPrimitive.content })
        val cached = builder.client.get(READ) {
            actor(Actor.MEMBER)
            header(HttpHeaders.IfNoneMatch, etag!!)
        }
        assertEquals(HttpStatusCode.NotModified, cached.status)
    }

    @Test
    fun `an upload without a configured storage answers 503`() = withService(storage = null) {
        assertEquals(HttpStatusCode.ServiceUnavailable, upload(manifest(add()), Actor.PUBLISHER, dryRun = false).status)
        assertEquals(0, count("icons"))
    }

    @Test
    fun `used icons are protected, reported and reconciled`() = withService {
        upload(manifest(add("DisclosureDownFill"), add("AddOutline")), Actor.PUBLISHER, false).ok()
        val fixture = fixture()
        assertEquals(HttpStatusCode.OK, setIcon(fixture, "disclosure.down.fill.16").status)
        val shrink = manifest(add("DisclosureDownFill", sizes = listOf(24)), add("AddOutline"))

        val dry = upload(shrink, Actor.PUBLISHER).ok()
        val used = dry.getValue("removedInUse").jsonArray.single().jsonObject
        assertEquals("DisclosureDownFill", used.string("name"))
        assertEquals("1", used.getValue("references").jsonPrimitive.content)

        val refused = upload(shrink, Actor.PUBLISHER, dryRun = false)
        assertEquals(HttpStatusCode.Conflict, refused.status)
        assertEquals("icons_in_use", json.parseToJsonElement(refused.bodyAsText()).jsonObject.string("code"))
        assertEquals("16,24", query("SELECT array_to_string(sizes, ',') FROM icons WHERE name = 'DisclosureDownFill'"))

        val allowed = upload(shrink, Actor.PUBLISHER, dryRun = false, allowRemovingUsed = true)
        assertEquals(HttpStatusCode.OK, allowed.status, allowed.bodyAsText())
        assertEquals("24", query("SELECT array_to_string(sizes, ',') FROM icons WHERE name = 'DisclosureDownFill'"))
    }

    @Test
    fun `an unsafe svg and a key collision are rejected and write nothing`() = withService {
        val unsafe = """{"schemaVersion":1,"source":{"package":"p","version":"1"},"icons":[{"name":"AddOutline","sizes":{"24":"<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>"}}]}"""
        val response = upload(unsafe, Actor.PUBLISHER, dryRun = false)
        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertEquals("unsafe_svg", json.parseToJsonElement(response.bodyAsText()).jsonObject.string("code"))
        val collision = upload(manifest(add("ABOutline"), add("AbOutline")), Actor.PUBLISHER, dryRun = false)
        assertEquals("legacy_key_collision", json.parseToJsonElement(collision.bodyAsText()).jsonObject.string("code"))
        assertEquals(0, count("icons"))
        assertTrue(storage.files.isEmpty())
    }

    @Test
    fun `a value of an icon property is checked against the catalog on write`() = withService {
        upload(
            manifest(add("DisclosureDownFill"), add("InfoCircleOutline", sizes = listOf(16))),
            Actor.PUBLISHER,
            false,
        ).ok()
        val fixture = fixture()
        assertEquals(HttpStatusCode.OK, setIcon(fixture, "disclosure.down.fill.16").status)
        assertEquals(
            "disclosure.down.fill.16",
            query("SELECT value FROM invariant_property_value_revisions WHERE value IS NOT NULL"),
        )

        val unknown = setIcon(fixture, "legacy.star.24")
        assertEquals(HttpStatusCode.BadRequest, unknown.status)
        assertEquals("unknown_icon", json.parseToJsonElement(unknown.bodyAsText()).jsonObject.string("code"))
        assertEquals(HttpStatusCode.BadRequest, setIcon(fixture, "info.circle.outline.24").status)
        // a value without a style means the outline icon of the catalog
        assertEquals(HttpStatusCode.OK, setIcon(fixture, "info.circle.16").status)
        assertEquals(HttpStatusCode.BadRequest, setIcon(fixture, "info.circle.24").status)
        setIcon(fixture, "disclosure.down.fill.16")
        assertEquals(
            "disclosure.down.fill.16",
            query("SELECT value FROM invariant_property_value_revisions WHERE value IS NOT NULL"),
        )

        // writing the stored value again is accepted even when the catalog no longer has it
        upload(
            manifest(add("InfoCircleOutline", sizes = listOf(16))),
            Actor.PUBLISHER,
            false,
            allowRemovingUsed = true,
        ).ok()
        assertEquals(HttpStatusCode.OK, setIcon(fixture, "disclosure.down.fill.16").status)
    }

    @Test
    fun `invariant values of an icon property are checked on create and update`() = withService {
        upload(manifest(add("DisclosureDownFill"), add("AddOutline")), Actor.PUBLISHER, false).ok()
        val fixture = fixture()
        val component = query("SELECT id FROM components WHERE name = 'Button'")
        val state = id(post("/api/design-systems/catalog/states", """{"name":"icon-state"}""").bodyAsText())
        val stateSet =
            id(post("/api/design-systems/catalog/state-sets/resolve", """{"stateIds":["$state"]}""").bodyAsText())
        suspend fun create(value: String?) = post(
            "/api/design-systems/${fixture.ds}/invariant-property-values",
            """{"propertyId":"${fixture.property}","componentId":"$component","appearanceId":"${fixture.appearance}",""" +
                (value?.let { """"value":"$it",""" } ?: "") + """"stateSetId":"$stateSet"}""",
        )

        val rejected = create("legacy.star.24")
        assertEquals(HttpStatusCode.BadRequest, rejected.status)
        assertEquals("unknown_icon", json.parseToJsonElement(rejected.bodyAsText()).jsonObject.string("code"))
        val created = create("disclosure.down.fill.16")
        assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
        val valueId = id(created.bodyAsText())

        suspend fun patch(value: String) = builder.client.patch(
            "/api/design-systems/${fixture.ds}/invariant-property-values/$valueId",
        ) {
            actor(Actor.ADMIN)
            contentType(ContentType.Application.Json)
            setBody("""{"value":"$value"}""")
        }
        assertEquals(HttpStatusCode.BadRequest, patch("info.circle.outline.16").status)
        assertEquals(HttpStatusCode.OK, patch("add.outline.24").status)
        // the stored value is accepted again even after it leaves the catalog
        upload(manifest(add("DisclosureDownFill")), Actor.PUBLISHER, false, allowRemovingUsed = true).ok()
        assertEquals(HttpStatusCode.OK, patch("add.outline.24").status)
    }

    @Test
    fun `values of style combinations are checked, protected and accepted again as stored`() = withService {
        upload(manifest(add("DisclosureDownFill"), add("AddOutline")), Actor.PUBLISHER, false).ok()
        val fixture = fixture()
        val state = id(post("/api/design-systems/catalog/states", """{"name":"icon-state"}""").bodyAsText())
        val stateSet =
            id(post("/api/design-systems/catalog/state-sets/resolve", """{"stateIds":["$state"]}""").bodyAsText())
        suspend fun create(value: String) = post(
            "/api/design-systems/${fixture.ds}/style-combinations",
            """{"propertyId":"${fixture.property}","appearanceId":"${fixture.appearance}","combinationKey":"view=default",""" +
                """"value":"$value","stateSetId":"$stateSet"}""",
        )

        val rejected = create("legacy.star.24")
        assertEquals(HttpStatusCode.BadRequest, rejected.status)
        assertEquals("unknown_icon", json.parseToJsonElement(rejected.bodyAsText()).jsonObject.string("code"))
        val created = create("add.outline.24")
        assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
        val combinationId = id(created.bodyAsText())

        // an icon used only in a combination is protected from removal
        val refused = upload(manifest(add("DisclosureDownFill")), Actor.PUBLISHER, false)
        assertEquals(HttpStatusCode.Conflict, refused.status)
        assertEquals("icons_in_use", json.parseToJsonElement(refused.bodyAsText()).jsonObject.string("code"))

        suspend fun patch(value: String) = builder.client.patch(
            "/api/design-systems/${fixture.ds}/style-combinations/$combinationId",
        ) {
            actor(Actor.ADMIN)
            contentType(ContentType.Application.Json)
            setBody("""{"value":"$value"}""")
        }
        assertEquals(HttpStatusCode.BadRequest, patch("info.circle.outline.16").status)
        upload(manifest(add("DisclosureDownFill")), Actor.PUBLISHER, false, allowRemovingUsed = true).ok()
        // the stored value is accepted again even after it leaves the catalog
        assertEquals(HttpStatusCode.OK, patch("add.outline.24").status)
    }

    @Test
    fun `an oversized upload is refused with 413`() = withService {
        val response = builder.client.post("$PATH?dryRun=true") {
            actor(Actor.PUBLISHER)
            contentType(ContentType.Application.Json)
            setBody("x".repeat(33 * 1024 * 1024))
        }
        assertEquals(HttpStatusCode.PayloadTooLarge, response.status)
        assertEquals(0, count("icons"))
    }

    // ── helpers ───────────────────────────────────────────────────────────────────────────

    private class Fixture(val ds: String, val appearance: String, val property: String)

    private suspend fun fixture(): Fixture {
        val ds = id(post("/api/design-systems", """{"name":"alpha","projectName":"alpha"}""").bodyAsText())
        val component =
            id(
                post(
                    "/api/design-systems/catalog/components",
                    """{"name":"Button","platform":"compose"}""",
                ).bodyAsText(),
            )
        val config = """{"colorSchemeVariationId":"view","invariants":{},"variations":[
            {"id":"view","name":"view","values":[{"name":"default","properties":{}}]},
            {"id":"size","name":"size","values":[{"name":"a","properties":{}}]}]}"""
        val imported = post(
            "/api/design-systems/$ds/component-config/import",
            """{"platform":"compose","meta":{"name":"fixture","source":"kotlin-test"},"dryRun":false,
               "components":[{"componentName":"button","styleName":"default","config":$config}]}""",
        )
        assertEquals(HttpStatusCode.OK, imported.status, imported.bodyAsText())
        val property = id(
            post(
                "/api/design-systems/catalog/properties",
                """{"componentId":"$component","name":"closedIcon","type":"icon"}""",
            ).bodyAsText(),
        )
        val appearance = query(
            "SELECT id FROM appearances WHERE design_system_id = '$ds' ORDER BY created_at LIMIT 1",
        )
        return Fixture(ds, appearance, property)
    }

    private suspend fun setIcon(fixture: Fixture, value: String): HttpResponse = builder.client.put(
        "/api/design-systems/${fixture.ds}/appearances/${fixture.appearance}/property-values",
    ) {
        actor(Actor.ADMIN)
        contentType(ContentType.Application.Json)
        setBody("""{"propertyId":"${fixture.property}","styleIds":[],"states":[],"value":"$value"}""")
    }

    private suspend fun post(path: String, body: String) = builder.client.post(path) {
        actor(Actor.ADMIN)
        contentType(ContentType.Application.Json)
        setBody(body)
    }

    private fun add(
        name: String = "AddOutline",
        sizes: List<Int> = listOf(16, 24),
        category: String? = null,
        aliases: List<String> = emptyList(),
    ): String {
        val svgs = sizes.joinToString(",") {
            """"$it":"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 $it $it'><path d='M0 0h$it'/></svg>""""
        }
        val extra = (category?.let { ""","category":"$it"""" } ?: "") +
            if (aliases.isEmpty()) "" else ""","aliases":[${aliases.joinToString(",") { "\"$it\"" }}]"""
        return """{"name":"$name"$extra,"sizes":{$svgs}}"""
    }

    private fun manifest(vararg icons: String, version: String = "1.0.0") =
        """{"schemaVersion":1,"source":{"package":"@salutejs/sdds-icons","version":"$version"},"icons":[${icons.joinToString(
            ",",
        )}]}"""

    private suspend fun upload(
        body: String,
        actor: Actor,
        dryRun: Boolean = true,
        allowRemovingUsed: Boolean = false,
    ): HttpResponse = builder.client.post("$PATH?dryRun=$dryRun&allowRemovingUsed=$allowRemovingUsed") {
        actor(actor)
        contentType(ContentType.Application.Json)
        setBody(body)
    }

    private suspend fun read(actor: Actor = Actor.MEMBER): HttpResponse = builder.client.get(READ) { actor(actor) }

    private suspend fun HttpResponse.ok(): JsonObject {
        assertEquals(HttpStatusCode.OK, status, bodyAsText())
        return json.parseToJsonElement(bodyAsText()).jsonObject
    }

    private fun JsonObject.string(name: String) = getValue(name).jsonPrimitive.content

    private fun id(body: String) = json.parseToJsonElement(body).jsonObject.string("id")

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
            Actor.MEMBER -> {
                header("X-User-Id", "integration-user")
                header("X-Project-Id", "project-a")
                header("X-Project-Role", "owner")
                header("X-System-Admin", "false")
            }
        }
    }

    private class InMemoryIconStorage(override val configured: Boolean = true) : IconAssetStorage {
        val files = java.util.concurrent.ConcurrentHashMap<String, String>()
        private val counter = java.util.concurrent.atomic.AtomicInteger()
        val puts: Int get() = counter.get()

        override suspend fun put(loadId: IconCatalogLoadId, asset: IconAsset) {
            counter.incrementAndGet()
            files["${loadId.value}/${asset.size.px}/${asset.name}.svg"] = asset.svg
        }

        override suspend fun listLoads() =
            files.keys.map { it.substringBefore('/') }.distinct().map { StoredIconLoad(it, Instant.now()) }

        override suspend fun deleteLoad(loadId: String) {
            files.keys.removeAll { it.startsWith("$loadId/") }
        }
    }

    private fun withService(
        storage: InMemoryIconStorage? = InMemoryIconStorage(),
        body: suspend IconCatalogHttpPostgresIntegrationTest.() -> Unit,
    ) {
        IsolatedPostgresDatabase.create().use { database ->
            testApplication {
                application { module(configuration(database), iconStorage = storage ?: InMemoryIconStorage(false)) }
                this@IconCatalogHttpPostgresIntegrationTest.postgres = database
                this@IconCatalogHttpPostgresIntegrationTest.builder = this
                this@IconCatalogHttpPostgresIntegrationTest.storage = storage ?: InMemoryIconStorage(false)
                kotlinx.coroutines.runBlocking { body() }
            }
        }
    }

    private fun configuration(database: IsolatedPostgresDatabase) = DsServiceConfiguration(
        port = 0,
        databaseUrl = database.jdbcUrl,
        databaseUser = database.username,
        databasePassword = database.password,
        databasePoolSize = 4,
        databaseConnectionTimeoutMs = 5_000,
        authorizationPolicyPath = null,
        runFlyway = true,
        adoptExistingSchema = false,
        expectedSchemaFingerprint = null,
        composePreviewPlugin = ComposePreviewPluginConfiguration(publicBaseUrl = PUBLIC_BASE),
    )

    private fun count(tableAndWhere: String): Int = query("SELECT count(*) FROM $tableAndWhere").toInt()

    private fun query(sql: String): String = DriverManager.getConnection(
        postgres.jdbcUrl,
        postgres.username,
        postgres.password,
    ).use {
        it.createStatement().use { statement ->
            statement.executeQuery(sql).use { rows ->
                rows.next()
                rows.getString(1)
            }
        }
    }

    private companion object {
        const val PATH = "/api/admin/icons/catalog"
        const val READ = "/api/design-systems/catalog/icons"
        const val PUBLIC_BASE = "https://plugins.example.test/compose-preview"
    }
}
