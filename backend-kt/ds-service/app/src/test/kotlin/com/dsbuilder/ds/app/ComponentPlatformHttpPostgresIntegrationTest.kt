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
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

/**
 * Platform identity of components, deprecated platform names and the platform-aware component-config routes
 * (change split-component-platforms-and-api-deprecated, mirrored from db-service).
 */
class ComponentPlatformHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = false }

    @Test
    fun `a component is identified by its name and platform`() = withService {
        val missing = post("/api/ds/components", """{"name":"Avatar"}""", admin = true)
        val invalid = post("/api/ds/components", """{"name":"Avatar","platform":"android"}""", admin = true)
        assertEquals(HttpStatusCode.BadRequest, missing.status)
        assertEquals(HttpStatusCode.BadRequest, invalid.status)

        val compose = post("/api/ds/components", """{"name":"Avatar","platform":"compose"}""", admin = true)
        val xml = post("/api/ds/components", """{"name":"Avatar","platform":"xml"}""", admin = true)
        assertEquals(HttpStatusCode.Created, compose.status, compose.bodyAsText())
        assertEquals(HttpStatusCode.Created, xml.status, xml.bodyAsText())
        assertEquals("compose", field(compose.bodyAsText(), "platform"))
        assertEquals("xml", field(xml.bodyAsText(), "platform"))
        assertNotEquals(id(compose.bodyAsText()), id(xml.bodyAsText()))

        val duplicate = post("/api/ds/components", """{"name":"Avatar","platform":"compose"}""", admin = true)
        assertTrue(duplicate.status.value >= 400, "a duplicate (name, platform) must be rejected: ${duplicate.status}")
        assertEquals(2, count("components WHERE name = 'Avatar'"))
    }

    @Test
    fun `the platform of a property alias follows its component and deprecation is stored per alias`() = withService {
        val component =
            id(post("/api/ds/components", """{"name":"Toast","platform":"xml"}""", admin = true).bodyAsText())
        val property = id(
            post(
                "/api/ds/properties",
                """{"componentId":"$component","name":"textColor","type":"color"}""",
                admin = true,
            )
                .bodyAsText(),
        )

        val created = post(
            "/api/ds/property-platform-params",
            """{"propertyId":"$property","platform":"xml","name":"sd_textColor","deprecated":true,""" +
                """"deprecatedMessage":"Use android:textColor"}""",
            admin = true,
        )
        assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
        val alias = id(created.bodyAsText())
        assertTrue(
            json.parseToJsonElement(created.bodyAsText()).jsonObject.getValue("deprecated").jsonPrimitive.boolean,
        )
        assertEquals("Use android:textColor", field(created.bodyAsText(), "deprecatedMessage"))

        val plain = post(
            "/api/ds/property-platform-params",
            """{"propertyId":"$property","platform":"xml","name":"android:textColor"}""",
            admin = true,
        )
        assertEquals(HttpStatusCode.Created, plain.status, plain.bodyAsText())
        val plainBody = json.parseToJsonElement(plain.bodyAsText()).jsonObject
        assertFalse(plainBody.getValue("deprecated").jsonPrimitive.boolean)
        assertTrue(plainBody.getValue("deprecatedMessage") is JsonNull)

        val clearedMessage = patch(
            "/api/ds/property-platform-params/$alias",
            """{"deprecated":false,"deprecatedMessage":null}""",
        )
        assertEquals(HttpStatusCode.OK, clearedMessage.status, clearedMessage.bodyAsText())
        assertTrue(
            json.parseToJsonElement(clearedMessage.bodyAsText()).jsonObject.getValue("deprecatedMessage") is JsonNull,
        )

        val emptyMessage =
            patch("/api/ds/property-platform-params/$alias", """{"deprecated":true,"deprecatedMessage":""}""")
        assertEquals("", field(emptyMessage.bodyAsText(), "deprecatedMessage"))

        val messageWithoutMark = patch(
            "/api/ds/property-platform-params/$alias",
            """{"deprecated":false,"deprecatedMessage":"still here"}""",
        )
        assertTrue(messageWithoutMark.status.value >= 400, "a message without the mark violates the check constraint")

        val foreign = post(
            "/api/ds/property-platform-params",
            """{"propertyId":"$property","platform":"web","name":"x"}""",
            admin = true,
        )
        assertTrue(foreign.status.value >= 400, "an alias of another platform must be rejected: ${foreign.status}")
        assertEquals(2, count("property_platform_params WHERE property_id = '$property'"))
    }

    @Test
    fun `component config is read written and exported per platform`() = withService {
        val designSystem =
            id(post("/api/ds/design-systems", """{"name":"alpha","projectName":"alpha"}""", owner = true).bodyAsText())
        val web = id(post("/api/ds/components", """{"name":"Button","platform":"web"}""", admin = true).bodyAsText())
        val compose =
            id(post("/api/ds/components", """{"name":"Button","platform":"compose"}""", admin = true).bodyAsText())
        for (component in listOf(web, compose)) {
            post("/api/ds/properties", """{"componentId":"$component","name":"shape","type":"value"}""", admin = true)
        }
        post(
            "/api/ds/design-system-versions",
            """{"designSystemId":"$designSystem","version":"1.0.0","snapshot":{},"publicationStatus":"published"}""",
            owner = true,
        )

        val withoutPlatform =
            post("/api/ds/component-config/import", importBody(designSystem, platform = null), editor = true)
        assertEquals(HttpStatusCode.BadRequest, withoutPlatform.status)
        val wrongPlatform =
            post("/api/ds/component-config/import", importBody(designSystem, platform = "android"), editor = true)
        assertEquals(HttpStatusCode.BadRequest, wrongPlatform.status)

        val imported =
            post("/api/ds/component-config/import", importBody(designSystem, platform = "compose"), editor = true)
        assertEquals(HttpStatusCode.OK, imported.status, imported.bodyAsText())
        assertEquals("1", field(imported.bodyAsText(), "created"))
        assertEquals(1, count("appearances WHERE component_id = '$compose'"))
        assertEquals(0, count("appearances WHERE component_id = '$web'"))

        val missingPlatformRead =
            get("/api/ds/component-config?ds=alpha&version=1.0.0&appearance=default&component=Button")
        assertEquals(HttpStatusCode.BadRequest, missingPlatformRead.status)
        val composeRead = get(
            "/api/ds/component-config?ds=alpha&version=1.0.0&appearance=default&component=Button&platform=compose",
        )
        assertEquals(HttpStatusCode.OK, composeRead.status, composeRead.bodyAsText())
        val webRead =
            get("/api/ds/component-config?ds=alpha&version=1.0.0&appearance=default&component=Button&platform=web")
        assertEquals(HttpStatusCode.NotFound, webRead.status)

        val noNative =
            post("/api/ds/component-config/import", importBody(designSystem, platform = "ios"), editor = true)
        assertEquals(HttpStatusCode.OK, noNative.status, noNative.bodyAsText())
        val rejected = json.parseToJsonElement(noNative.bodyAsText()).jsonObject.getValue("rejected").jsonArray
        assertEquals(1, rejected.size)
        assertTrue(rejected.single().jsonObject.getValue("reason").jsonPrimitive.content.contains("platform 'ios'"))

        val exportedCompose = post(
            "/api/ds/component-config/export",
            """{"designSystemId":"$designSystem","platform":"compose"}""",
            viewer = true,
        )
        val exportedWeb = post(
            "/api/ds/component-config/export",
            """{"designSystemId":"$designSystem","platform":"web"}""",
            viewer = true,
        )
        val exportedWithoutPlatform = post(
            "/api/ds/component-config/export",
            """{"designSystemId":"$designSystem"}""",
            viewer = true,
        )
        assertEquals(1, exportedCompose.entries())
        assertEquals(0, exportedWeb.entries())
        assertEquals(HttpStatusCode.BadRequest, exportedWithoutPlatform.status)
        assertEquals(
            "compose",
            query(
                "SELECT data->>'platform' FROM design_system_changes WHERE entity_type = 'components:import' LIMIT 1",
            ),
        )
    }

    @Test
    fun `journal rows without a design system never reach the project feeds`() = withService {
        val designSystem =
            id(post("/api/ds/design-systems", """{"name":"beta","projectName":"beta"}""", owner = true).bodyAsText())
        execute(
            "INSERT INTO design_system_changes (design_system_id, entity_type, entity_id, operation, data) " +
                "VALUES (NULL, 'components:import-api-meta', '${UUID.randomUUID()}', 'created', '{}'::jsonb)",
        )

        val all = get("/api/ds/design-system-changes", viewer = true)
        val byDesignSystem = get("/api/ds/design-system-changes/by-design-system/$designSystem", viewer = true)

        assertEquals(HttpStatusCode.OK, all.status, all.bodyAsText())
        assertEquals(HttpStatusCode.OK, byDesignSystem.status, byDesignSystem.bodyAsText())
        assertFalse(all.bodyAsText().contains("components:import-api-meta"))
        assertEquals(JsonArray(emptyList()), json.parseToJsonElement(byDesignSystem.bodyAsText()))
    }

    private suspend fun io.ktor.client.statement.HttpResponse.entries(): Int =
        json.parseToJsonElement(bodyAsText()).jsonObject.getValue("components").jsonArray.size

    private fun importBody(designSystemId: String, platform: String?) =
        """
        {
          "designSystemId":"$designSystemId",
          ${platform?.let { "\"platform\":\"$it\"," } ?: ""}
          "meta":{"name":"fixture","source":"kotlin-test"},
          "dryRun":false,
          "components":[{
            "componentName":"button",
            "styleName":"default",
            "config":{"invariants":{"shape":{"type":"value","value":{"radius":8}}}}
          }]
        }
        """.trimIndent()

    // ── harness ────────────────────────────────────────────────────────────────────────────────────

    private class Service(val postgres: PostgreSQLContainer<Nothing>, val builder: ApplicationTestBuilder)

    private lateinit var service: Service

    private fun withService(body: suspend ComponentPlatformHttpPostgresIntegrationTest.() -> Unit) {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
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
    ) = service.builder.client.post(path) {
        actor(admin, owner, editor, viewer)
        contentType(ContentType.Application.Json)
        setBody(body)
    }

    private suspend fun patch(path: String, body: String) = service.builder.client.patch(path) {
        actor(admin = true, owner = false, editor = false, viewer = false)
        contentType(ContentType.Application.Json)
        setBody(body)
    }

    private suspend fun get(path: String, viewer: Boolean = true) = service.builder.client.get(path) {
        actor(admin = false, owner = false, editor = false, viewer = viewer)
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

    private fun id(body: String): String = field(body, "id")

    private fun field(body: String, name: String): String =
        json.parseToJsonElement(
            body,
        ).jsonObject.getValue(name).let { if (it is JsonNull) "null" else it.jsonPrimitive.content }

    private fun count(tableAndWhere: String): Int = query("SELECT count(*) FROM $tableAndWhere").toInt()

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
}
