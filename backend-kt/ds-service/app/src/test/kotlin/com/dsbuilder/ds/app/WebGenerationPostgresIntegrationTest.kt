package com.dsbuilder.ds.app

import io.ktor.client.HttpClient
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
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.flywaydb.core.Flyway
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

/** Контракт данных web-генерации: web-адаптер и смещения в выгрузке. */
class WebGenerationPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = false }

    @Test
    fun `web adapter and export offsets match the reference contract`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            Flyway.configure().dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
                .locations("classpath:db/migration").target("6").load().migrate()
            val designSystemId = UUID.randomUUID().toString()
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                connection.prepareStatement(
                    "INSERT INTO design_systems(id, name, project_name, project_id) " +
                        "VALUES (?::uuid, 'alpha', 'alpha', 'project-a')",
                ).use { statement ->
                    statement.setString(1, designSystemId)
                    statement.executeUpdate()
                }
            }
            seedFixture(postgres, designSystemId)
            testApplication {
                application { module(configuration(postgres)) }
                val publishedId = publish(client, designSystemId)

                verifyWebAdapter(client, designSystemId)
                verifyWebAdapterAccess(client, designSystemId)
                verifyExportOffsets(client, designSystemId)
                verifySelectedBoundary(client, designSystemId, publishedId)
            }
        }
    }

    private suspend fun verifyWebAdapter(client: HttpClient, designSystemId: String) {
        val first = client.webAdapter("project-a", "viewer", designSystemId)
        assertEquals(HttpStatusCode.OK, first.status, first.bodyAsText())
        assertEquals(
            """[{"componentName":"icon-tab-item","name":"IconTabItem"},""" +
                """{"componentName":"tab-item","name":"TabItem"},""" +
                """{"componentName":"tabs","name":"Tabs","description":"Вкладки",""" +
                """"compose":["icon-tab-item","tab-item"],""" +
                """"styles":{"default":{"templates":{"padding":{"tabsPadding":"a $1"},""" +
                """"shape":{"tabsRadius":"0 $1"}}},"outline":{"templates":{"shape":{"tabsRadius":"1 $1"}}}}}]""",
            first.bodyAsText(),
        )
        assertEquals(first.bodyAsText(), client.webAdapter("project-a", "viewer", designSystemId).bodyAsText())

        val emptyDesignSystemId = createPublishedDesignSystem(client, "empty")
        val empty = client.webAdapter("project-a", "viewer", emptyDesignSystemId)
        assertEquals(HttpStatusCode.OK, empty.status)
        assertEquals("[]", empty.bodyAsText())
    }

    private suspend fun verifyWebAdapterAccess(client: HttpClient, designSystemId: String) {
        assertEquals(HttpStatusCode.NotFound, client.webAdapter("project-b", "viewer", designSystemId).status)
        assertEquals(HttpStatusCode.NotFound, client.webAdapter("project-a", "viewer", MISSING_ID).status)

        val withoutScope = client.post(WEB_ADAPTER_PATH) {
            header("X-Actor-Type", "project_key")
            header("X-Project-Key-Id", "key-1")
            header("X-Project-Id", "project-a")
            header("X-Project-Scopes", "tokens:read")
            jsonBody("""{"designSystemId":"$designSystemId"}""")
        }
        assertEquals(HttpStatusCode.Forbidden, withoutScope.status)

        listOf("{}", """{"designSystemId":"not-a-uuid"}""").forEach { body ->
            val invalid = client.post(WEB_ADAPTER_PATH) {
                trusted("project-a", "viewer")
                jsonBody(body)
            }
            assertEquals(HttpStatusCode.BadRequest, invalid.status, body)
        }
    }

    private suspend fun verifyExportOffsets(client: HttpClient, designSystemId: String) {
        val exported = client.post("/api/ds/component-config/export") {
            trusted("project-a", "viewer")
            jsonBody(
                """{"designSystemId":"$designSystemId","platform":"web","components":["tabs"],"styles":["default"]}""",
            )
        }
        assertEquals(HttpStatusCode.OK, exported.status, exported.bodyAsText())
        val config = json.parseToJsonElement(exported.bodyAsText()).jsonObject
            .getValue("components").jsonArray.single().jsonObject.getValue("config").jsonObject
        val invariants = config.getValue("invariants").jsonObject
        // У строки смещения нет: берётся числовая поправка web-алиаса.
        assertEquals("-2", invariants.getValue("shape").jsonObject.getValue("adjustment").jsonPrimitive.content)
        // Нечисловая поправка смещением не считается.
        assertFalse("adjustment" in invariants.getValue("gap").jsonObject)

        val sizes = config.getValue("variations").jsonArray.single().jsonObject
            .getValue("values").jsonArray.map { it.jsonObject }
        // Копия значения строки смещением не считается.
        assertFalse("adjustment" in sizes.padding("m"))
        // Собственное смещение строки важнее поправки.
        assertEquals("1", sizes.padding("s").getValue("adjustment").jsonPrimitive.content)
        // У значения вариации смещения нет: берётся числовая поправка, отличная от значения.
        assertEquals("3", sizes.padding("l").getValue("adjustment").jsonPrimitive.content)

        val single = client.get(
            "/api/ds/component-config?ds=alpha&version=1.0.0&appearance=default&component=Tabs&platform=web",
        ) {
            trusted("project-a", "viewer")
        }
        assertEquals(HttpStatusCode.OK, single.status, single.bodyAsText())
        val singleShape = json.parseToJsonElement(single.bodyAsText()).jsonObject
            .getValue("invariants").jsonObject.getValue("shape").jsonObject
        assertFalse("adjustment" in singleShape, "чтение одного конфига не подставляет смещения из поправок")
    }

    private fun List<JsonObject>.padding(style: String): JsonObject =
        single { it.getValue("name").jsonPrimitive.content == style }
            .getValue("properties").jsonObject.getValue("padding").jsonObject

    private suspend fun createPublishedDesignSystem(client: HttpClient, name: String): String {
        val designSystem = client.post("/api/ds/design-systems") {
            trusted("project-a", "owner")
            jsonBody("""{"name":"$name","projectName":"$name"}""")
        }
        assertEquals(HttpStatusCode.Created, designSystem.status, designSystem.bodyAsText())
        val id = json.parseToJsonElement(designSystem.bodyAsText()).jsonObject.getValue("id").jsonPrimitive.content
        publish(client, id)
        return id
    }

    private suspend fun publish(client: HttpClient, id: String): String {
        val changed = client.patch("/api/ds/design-systems/$id") {
            trusted("project-a", "owner")
            header("X-DS-Base-Revision", "0")
            jsonBody("""{"description":"Fixture publication"}""")
        }
        assertEquals(HttpStatusCode.OK, changed.status, changed.bodyAsText())
        val current = client.get("/api/ds/design-systems/$id") { trusted("project-a", "owner") }
        assertEquals(HttpStatusCode.OK, current.status, current.bodyAsText())
        val draft = json.parseToJsonElement(current.bodyAsText()).jsonObject
        val version = client.post("/api/ds/design-system-versions") {
            trusted("project-a", "owner")
            header("Idempotency-Key", UUID.randomUUID().toString())
            jsonBody(
                """{"designSystemId":"$id","draftId":"${draft.getValue("draftId").jsonPrimitive.content}",""" +
                    """"draftRevision":${draft.getValue("draftRevision").jsonPrimitive.content},"version":"1.0.0"}""",
            )
        }
        assertEquals(HttpStatusCode.Created, version.status, version.bodyAsText())
        return json.parseToJsonElement(version.bodyAsText()).jsonObject.getValue("id").jsonPrimitive.content
    }

    private suspend fun verifySelectedBoundary(client: HttpClient, system: String, version: String) {
        val adjustments = client.get("/api/ds/invariant-platform-param-adjustments") {
            trusted("project-a", "viewer")
        }
        assertEquals(HttpStatusCode.OK, adjustments.status, adjustments.bodyAsText())
        val id = json.parseToJsonElement(adjustments.bodyAsText()).jsonArray.single {
            it.jsonObject["template"]?.jsonPrimitive?.content == "0 $1"
        }.jsonObject.getValue("id").jsonPrimitive.content
        val changed = client.patch("/api/ds/invariant-platform-param-adjustments/$id") {
            trusted("project-a", "owner")
            jsonBody("""{"template":"99 $1"}""")
        }
        assertEquals(HttpStatusCode.OK, changed.status, changed.bodyAsText())

        fun template(body: String): String = json.parseToJsonElement(body).jsonArray.single {
            it.jsonObject.getValue("name").jsonPrimitive.content == "Tabs"
        }.jsonObject.getValue("styles").jsonObject.getValue("default").jsonObject
            .getValue("templates").jsonObject.getValue("shape").jsonObject
            .getValue("tabsRadius").jsonPrimitive.content
        assertEquals("99 $1", template(client.webAdapter("project-a", "viewer", system).bodyAsText()))
        val historical = client.post("$WEB_ADAPTER_PATH?versionId=$version") {
            trusted("project-a", "viewer")
            jsonBody("""{"designSystemId":"$system"}""")
        }
        assertEquals(HttpStatusCode.OK, historical.status, historical.bodyAsText())
        assertEquals("0 $1", template(historical.bodyAsText()))
        listOf(null to "draft", version to "1.0.0").forEach { (boundary, expected) ->
            val suffix = boundary?.let { "?versionId=$it" }.orEmpty()
            val exported = client.post("/api/ds/component-config/export$suffix") {
                trusted("project-a", "viewer")
                jsonBody("""{"designSystemId":"$system","platform":"web"}""")
            }
            assertEquals(HttpStatusCode.OK, exported.status, exported.bodyAsText())
            val metadata = json.parseToJsonElement(exported.bodyAsText()).jsonObject.getValue("meta").jsonObject
            assertEquals(expected, metadata.getValue("version").jsonPrimitive.content)
        }
        val inaccessible = client.post("$WEB_ADAPTER_PATH?versionId=$version") {
            trusted("project-b", "viewer")
            jsonBody("""{"designSystemId":"$system"}""")
        }
        assertEquals(HttpStatusCode.NotFound, inaccessible.status)
    }

    /**
     * Три компонента с конфигурациями (`Tabs`, `TabItem`, `IconTabItem`) и `Orphan` без конфигурации.
     * У `Tabs` значения с шаблонами web-параметров и поправками, покрывающими правила выбора смещения.
     */
    private fun seedFixture(postgres: PostgreSQLContainer<Nothing>, designSystemId: String) {
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            fun insert(sql: String, vararg arguments: Any?): UUID = connection.prepareStatement(
                "$sql RETURNING id",
            ).use { statement ->
                arguments.forEachIndexed { index, argument -> statement.setObject(index + 1, argument) }
                statement.executeQuery().use { rows ->
                    rows.next()
                    rows.getObject(1, UUID::class.java)
                }
            }
            val ds = UUID.fromString(designSystemId)
            fun component(name: String, description: String?) =
                insert(
                    "INSERT INTO components (name, description, platform) VALUES (?, ?, 'web'::component_platform)",
                    name,
                    description,
                )
            fun appearance(componentId: UUID, name: String = "default") = insert(
                "INSERT INTO appearances (design_system_id, component_id, name) VALUES (?, ?, ?)",
                ds,
                componentId,
                name,
            )
            fun dependency(parent: UUID, child: UUID, type: String, order: Int) = insert(
                "INSERT INTO component_deps (parent_id, child_id, type, \"order\") VALUES (?, ?, ?::relation_type, ?)",
                parent,
                child,
                type,
                order,
            )
            fun property(componentId: UUID, name: String, type: String) = insert(
                "INSERT INTO properties (component_id, name, type) VALUES (?, ?, ?::property_type)",
                componentId,
                name,
                type,
            )
            fun param(propertyId: UUID, platform: String, name: String) = insert(
                "INSERT INTO property_platform_params (property_id, platform, name) " +
                    "VALUES (?, ?::component_platform, ?)",
                propertyId,
                platform,
                name,
            )

            val tabs = component("Tabs", "Вкладки")
            val tabItem = component("TabItem", "")
            val iconTabItem = component("IconTabItem", null)
            val orphan = component("Orphan", null)
            listOf(tabs, tabItem, iconTabItem, orphan).forEach { componentId ->
                insert(
                    "INSERT INTO design_system_components (design_system_id, component_id) VALUES (?, ?)",
                    ds,
                    componentId,
                )
            }
            val tabsAppearance = appearance(tabs)
            appearance(tabItem)
            appearance(iconTabItem)
            dependency(tabs, tabItem, "compose", 2)
            dependency(tabs, iconTabItem, "compose", 1)
            dependency(tabs, orphan, "compose", 0)
            dependency(tabItem, iconTabItem, "reuse", 1)

            val shape = property(tabs, "shape", "shape")
            val gap = property(tabs, "gap", "dimension")
            val padding = property(tabs, "padding", "dimension")
            // Алиасы только платформы компонента: xml-алиасы web-компонента запрещает триггер схемы.
            val shapeWeb = param(shape, "web", "tabsRadius")
            val gapWeb = param(gap, "web", "tabsGap")
            val paddingWeb = param(padding, "web", "tabsPadding")

            fun invariant(propertyId: UUID, value: String, appearanceId: UUID = tabsAppearance) = insert(
                "INSERT INTO invariant_property_values " +
                    "(property_id, design_system_id, component_id, appearance_id, value, state_set_id) " +
                    "VALUES (?, ?, ?, ?, ?, ?)",
                propertyId,
                ds,
                tabs,
                appearanceId,
                value,
                EMPTY_STATE_SET,
            )
            fun invariantAdjustment(valueId: UUID, paramId: UUID, value: String?, template: String?) = insert(
                "INSERT INTO invariant_platform_param_adjustments (ipv_id, platform_param_id, value, template) " +
                    "VALUES (?, ?, ?, ?)",
                valueId,
                paramId,
                value,
                template,
            )
            val shapeValue = invariant(shape, "round.l")
            invariantAdjustment(shapeValue, shapeWeb, "-2", "0 $1")
            invariantAdjustment(invariant(gap, "4"), gapWeb, "abc", null)
            // Второй стиль того же компонента: запись остаётся одна, а шаблоны раскладываются по стилям.
            invariantAdjustment(invariant(shape, "round.m", appearance(tabs, "outline")), shapeWeb, null, "1 $1")

            val size = insert("INSERT INTO variations (component_id, name) VALUES (?, 'size')", tabs)
            val axis = insert(
                "INSERT INTO appearance_variations (appearance_id, variation_id, position) VALUES (?, ?, 0)",
                tabsAppearance,
                size,
            )
            fun style(name: String, position: Int, adjustment: String?, offset: String, template: String) {
                val styleId = insert(
                    "INSERT INTO styles (design_system_id, variation_id, name) VALUES (?, ?, ?)",
                    ds,
                    size,
                    name,
                )
                insert(
                    "INSERT INTO appearance_variation_values (appearance_variation_id, style_id, position) " +
                        "VALUES (?, ?, ?)",
                    axis,
                    styleId,
                    position,
                )
                val valueId = insert(
                    "INSERT INTO variation_property_values " +
                        "(property_id, style_id, appearance_id, value, adjustment, state_set_id) " +
                        "VALUES (?, ?, ?, '8', ?, ?)",
                    padding,
                    styleId,
                    tabsAppearance,
                    adjustment,
                    EMPTY_STATE_SET,
                )
                insert(
                    "INSERT INTO variation_platform_param_adjustments (vpv_id, platform_param_id, value, template) " +
                        "VALUES (?, ?, ?, ?)",
                    valueId,
                    paddingWeb,
                    offset,
                    template,
                )
            }
            style("m", 0, adjustment = null, offset = "8", template = "b $1")
            style("s", 1, adjustment = "1", offset = "3", template = "a $1")
            style("l", 2, adjustment = null, offset = "3", template = "c $1")
        }
    }

    private suspend fun HttpClient.webAdapter(projectId: String, role: String, designSystemId: String) =
        post(WEB_ADAPTER_PATH) {
            trusted(projectId, role)
            jsonBody("""{"designSystemId":"$designSystemId"}""")
        }

    private fun configuration(postgres: PostgreSQLContainer<Nothing>) = DsServiceConfiguration(
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

    private fun HttpRequestBuilder.trusted(projectId: String, role: String) {
        header("X-Actor-Type", "user")
        header("X-User-Id", "integration-user")
        header("X-Project-Id", projectId)
        header("X-Project-Role", role)
        header("X-System-Admin", "false")
    }

    private fun HttpRequestBuilder.jsonBody(value: String) {
        contentType(ContentType.Application.Json)
        setBody(value)
    }

    private companion object {
        const val WEB_ADAPTER_PATH = "/api/ds/component-config/web-adapter"
        const val MISSING_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff"
        val EMPTY_STATE_SET: UUID = UUID.fromString("00000000-0000-4000-8000-0000000000ff")
    }
}
