package com.dsbuilder.ds.app

import io.ktor.client.HttpClient
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import io.ktor.utils.io.ByteReadChannel
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** End-to-end contract gate for HTTP, RBAC, ownership and component-config transactions. */
class DsServiceHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = false }

    @Test
    fun `project resources are isolated and component config import is atomic`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            testApplication {
                application { module(configuration(postgres)) }

                val openApi = json.parseToJsonElement(client.get("/openapi.json").bodyAsText()).jsonObject
                val operations = openApi.getValue("paths").jsonObject.flatMap { (template, pathItem) ->
                    pathItem.jsonObject.keys.map { method -> template to method }
                }
                assertEquals(168, operations.size)
                operations.forEach { (template, method) ->
                    val path = template.replace(Regex("\\{[^}]+}"), MISSING_ID)
                    val response = client.request(path) { this.method = HttpMethod.parse(method.uppercase()) }
                    assertEquals(HttpStatusCode.Forbidden, response.status, "$method $template must enforce RBAC")
                }

                val forbidden = client.post("/api/ds/design-systems") {
                    trusted("project-a", "viewer")
                    jsonBody("""{"name":"forbidden","projectName":"forbidden"}""")
                }
                assertEquals(HttpStatusCode.Forbidden, forbidden.status)

                val invalid = client.post("/api/ds/design-systems") {
                    trusted("project-a", "owner")
                    jsonBody("""{"name":" ","projectName":"alpha"}""")
                }
                assertEquals(HttpStatusCode.BadRequest, invalid.status)
                assertEquals(
                    """{"error":{"formErrors":[],"fieldErrors":{"name":""" +
                        """["Too small: expected string to have >=1 characters"]}}}""",
                    invalid.bodyAsText(),
                )

                val missingFields = client.post("/api/ds/design-systems") {
                    trusted("project-a", "owner")
                    jsonBody("{}")
                }
                assertEquals(
                    """{"error":{"formErrors":[],"fieldErrors":{"name":""" +
                        """["Invalid input: expected string, received undefined"],"projectName":""" +
                        """["Invalid input: expected string, received undefined"]}}}""",
                    missingFields.bodyAsText(),
                )

                val wrongType = client.post("/api/ds/design-systems") {
                    trusted("project-a", "owner")
                    jsonBody("""{"name":42,"projectName":"alpha"}""")
                }
                assertEquals(HttpStatusCode.BadRequest, wrongType.status)
                assertEquals(
                    """{"error":{"formErrors":[],"fieldErrors":{"name":""" +
                        """["Invalid input: expected string, received number"]}}}""",
                    wrongType.bodyAsText(),
                )

                verifyThemeCreationWithoutComponentMetadata(client, postgres)

                val componentIds = seedComponentPrerequisites(postgres)
                val componentId = componentIds.getValue("Button")
                val designSystem = client.post("/api/ds/design-systems") {
                    trusted("project-a", "owner")
                    jsonBody("""{"name":"alpha","projectName":"alpha"}""")
                }
                assertEquals(HttpStatusCode.Created, designSystem.status, designSystem.bodyAsText())
                val designSystemId = id(designSystem.bodyAsText())
                assertEquals(0, rowCount(postgres, "design_system_components"))
                assertEquals(0, rowCount(postgres, "appearances"))

                val version = client.post("/api/ds/design-system-versions") {
                    trusted("project-a", "owner")
                    jsonBody(
                        """
                        {
                          "designSystemId":"$designSystemId",
                          "version":"1.0.0",
                          "snapshot":{},
                          "publicationStatus":"published"
                        }
                        """.trimIndent(),
                    )
                }
                assertEquals(HttpStatusCode.Created, version.status, version.bodyAsText())

                val change = client.post("/api/ds/design-system-changes") {
                    trusted("project-a", "owner")
                    jsonBody(
                        """
                        {
                          "designSystemId":"$designSystemId",
                          "entityType":"design-system",
                          "entityId":"$designSystemId",
                          "operation":"created",
                          "data":{}
                        }
                        """.trimIndent(),
                    )
                }
                assertEquals(HttpStatusCode.Created, change.status, change.bodyAsText())
                val changes = client.get("/api/ds/design-systems/$designSystemId/changes") {
                    trusted("project-a", "viewer")
                }
                assertEquals(HttpStatusCode.OK, changes.status)

                val hidden = client.get("/api/ds/design-systems/$designSystemId") {
                    trusted("project-b", "owner")
                }
                assertEquals(HttpStatusCode.NotFound, hidden.status)

                val tenant = client.post("/api/ds/tenants") {
                    trusted("project-a", "editor")
                    jsonBody("""{"designSystemId":"$designSystemId","name":"dark"}""")
                }
                assertEquals(HttpStatusCode.Created, tenant.status, tenant.bodyAsText())
                val tenantId = id(tenant.bodyAsText())
                assertEquals(63, rowCount(postgres, "design_system_components"))
                assertEquals(66, rowCount(postgres, "appearances"))
                assertEquals(
                    "malachite",
                    json.parseToJsonElement(tenant.bodyAsText()).jsonObject
                        .getValue("colorConfig").jsonObject.getValue("profile").jsonPrimitive.content,
                )
                val duplicateTenant = client.post("/api/ds/tenants") {
                    trusted("project-a", "editor")
                    jsonBody("""{"designSystemId":"$designSystemId","name":"  dark  "}""")
                }
                assertEquals(HttpStatusCode.Conflict, duplicateTenant.status, duplicateTenant.bodyAsText())
                assertEquals(
                    "TENANT_NAME_CONFLICT",
                    json.parseToJsonElement(duplicateTenant.bodyAsText()).jsonObject
                        .getValue("code").jsonPrimitive.content,
                )
                val initialValues = client.get("/api/ds/tenants/$tenantId/token-values") {
                    trusted("project-a", "viewer")
                }
                assertEquals(HttpStatusCode.OK, initialValues.status)
                assertTrue(initialValues.bodyAsText().length > 2)
                val savedValues = client.put("/api/ds/tenants/$tenantId/token-values") {
                    trusted("project-a", "editor")
                    jsonBody("""{"editRevision":0,"values":[]}""")
                }
                assertEquals(HttpStatusCode.OK, savedValues.status, savedValues.bodyAsText())
                assertEquals(
                    "1",
                    json.parseToJsonElement(savedValues.bodyAsText()).jsonObject
                        .getValue("editRevision").jsonPrimitive.content,
                )
                val staleValues = client.put("/api/ds/tenants/$tenantId/token-values") {
                    trusted("project-a", "editor")
                    jsonBody("""{"editRevision":0,"values":[]}""")
                }
                assertEquals(HttpStatusCode.Conflict, staleValues.status, staleValues.bodyAsText())
                assertEquals(
                    "TENANT_EDIT_CONFLICT",
                    json.parseToJsonElement(staleValues.bodyAsText()).jsonObject
                        .getValue("code").jsonPrimitive.content,
                )

                val token = client.post("/api/ds/tokens") {
                    trusted("project-a", "editor")
                    jsonBody(
                        """{"designSystemId":"$designSystemId","name":"integration.surface.default","type":"color"}""",
                    )
                }
                assertEquals(HttpStatusCode.Created, token.status)
                val tokenId = id(token.bodyAsText())

                val imported = client.post("/api/ds/component-config/import") {
                    trusted("project-a", "editor")
                    jsonBody(importBody(designSystemId, "default", dryRun = false))
                }
                assertEquals(HttpStatusCode.OK, imported.status, imported.bodyAsText())
                val report = json.parseToJsonElement(imported.bodyAsText()).jsonObject
                assertEquals("1", report.getValue("created").jsonPrimitive.content)
                assertEquals("[]", report.getValue("unknownStates").toString())

                val single = client.get(
                    "/api/ds/component-config?ds=alpha&version=1.0.0&appearance=default&component=Button",
                ) { trusted("project-a", "viewer") }
                assertEquals(HttpStatusCode.OK, single.status, single.bodyAsText())
                assertTrue(single.bodyAsText().contains("pressed"))

                val exported = client.post("/api/ds/component-config/export") {
                    trusted("project-a", "viewer")
                    jsonBody("""{"designSystemId":"$designSystemId","components":["button"]}""")
                }
                assertEquals(HttpStatusCode.OK, exported.status, exported.bodyAsText())
                assertTrue(exported.bodyAsText().contains("\"version\":\"1.0.0\""))

                val countsBeforeDryRun = counts(postgres)
                val dryRun = client.post("/api/ds/component-config/import") {
                    trusted("project-a", "editor")
                    jsonBody(importBody(designSystemId, "preview", dryRun = true))
                }
                assertEquals(HttpStatusCode.OK, dryRun.status, dryRun.bodyAsText())
                assertEquals(countsBeforeDryRun, counts(postgres))

                val absentPreview = client.get(
                    "/api/ds/component-config?ds=alpha&version=1.0.0&appearance=preview&component=Button",
                ) { trusted("project-a", "viewer") }
                assertEquals(HttpStatusCode.NotFound, absentPreview.status)

                val tooLarge = client.post("/api/ds/component-config/import") {
                    trusted("project-a", "editor")
                    jsonBody(
                        importBody(designSystemId, "oversize", dryRun = false)
                            .replace("kotlin-test", "x".repeat(16 * 1024 * 1024)),
                    )
                }
                assertEquals(HttpStatusCode.PayloadTooLarge, tooLarge.status)

                val crossProjectImport = client.post("/api/ds/component-config/import") {
                    trusted("project-b", "editor")
                    jsonBody(importBody(designSystemId, "hidden", dryRun = false))
                }
                assertEquals(HttpStatusCode.NotFound, crossProjectImport.status)

                val foreignDesignSystem = client.post("/api/ds/design-systems") {
                    trusted("project-b", "owner")
                    jsonBody("""{"name":"beta","projectName":"beta"}""")
                }
                assertEquals(HttpStatusCode.Created, foreignDesignSystem.status)
                val foreignDesignSystemId = id(foreignDesignSystem.bodyAsText())
                val foreignTenant = client.post("/api/ds/tenants") {
                    trusted("project-b", "editor")
                    jsonBody("""{"designSystemId":"$foreignDesignSystemId","name":"foreign"}""")
                }
                assertEquals(HttpStatusCode.Created, foreignTenant.status)
                val foreignTenantId = id(foreignTenant.bodyAsText())
                val crossProjectTokenValue = client.post("/api/ds/token-values") {
                    trusted("project-a", "editor")
                    jsonBody("""{"tokenId":"$tokenId","tenantId":"$foreignTenantId","value":"#fff"}""")
                }
                assertEquals(HttpStatusCode.NotFound, crossProjectTokenValue.status)

                val foreignOnlyComponent = client.post("/api/ds/components") {
                    trustedSystemAdmin()
                    jsonBody("""{"name":"ForeignOnly"}""")
                }
                val foreignOnlyComponentId = id(foreignOnlyComponent.bodyAsText())
                assertEquals(
                    HttpStatusCode.Created,
                    client.post("/api/ds/design-system-components") {
                        trusted("project-b", "editor")
                        jsonBody(
                            """{"designSystemId":"$foreignDesignSystemId","componentId":"$foreignOnlyComponentId"}""",
                        )
                    }.status,
                )
                val foreignProperty = client.post("/api/ds/properties") {
                    trustedSystemAdmin()
                    jsonBody("""{"componentId":"$foreignOnlyComponentId","name":"foreign","type":"value"}""")
                }
                val foreignPropertyId = id(foreignProperty.bodyAsText())
                val foreignAppearance = client.post("/api/ds/appearances") {
                    trusted("project-b", "editor")
                    jsonBody(
                        """{"designSystemId":"$foreignDesignSystemId","componentId":"$foreignOnlyComponentId"}""",
                    )
                }
                val foreignAppearanceId = id(foreignAppearance.bodyAsText())
                val globalState = client.post("/api/ds/states") {
                    trustedSystemAdmin()
                    jsonBody("""{"name":"global-impact"}""")
                }
                val globalStateId = id(globalState.bodyAsText())
                val globalStateSet = client.post("/api/ds/state-sets/resolve") {
                    trustedSystemAdmin()
                    jsonBody("""{"stateIds":["$globalStateId"]}""")
                }
                val globalStateSetId = id(globalStateSet.bodyAsText())
                val foreignValue = client.post("/api/ds/invariant-property-values") {
                    trusted("project-b", "editor")
                    jsonBody(
                        """{"propertyId":"$foreignPropertyId","designSystemId":"$foreignDesignSystemId",""" +
                            """"componentId":"$foreignOnlyComponentId","appearanceId":"$foreignAppearanceId",""" +
                            """"value":"foreign","stateSetId":"$globalStateSetId"}""",
                    )
                }
                assertEquals(HttpStatusCode.Created, foreignValue.status, foreignValue.bodyAsText())
                val scopedImpact = client.get("/api/ds/states/$globalStateId/impact") {
                    trusted("project-a", "viewer")
                }
                assertEquals(HttpStatusCode.OK, scopedImpact.status)
                assertEquals("""{"stateSets":0,"values":0,"components":0}""", scopedImpact.bodyAsText())

                val sharedMutation = client.patch("/api/ds/components/$componentId") {
                    trusted("project-a", "editor")
                    jsonBody("""{"description":"must stay shared"}""")
                }
                assertEquals(HttpStatusCode.NotFound, sharedMutation.status)

                val privateComponent = client.post("/api/ds/components") {
                    trustedSystemAdmin()
                    jsonBody("""{"name":"PrivateButton"}""")
                }
                assertEquals(HttpStatusCode.Created, privateComponent.status)
                val privateComponentId = id(privateComponent.bodyAsText())
                val privateLink = client.post("/api/ds/design-system-components") {
                    trusted("project-a", "editor")
                    jsonBody("""{"designSystemId":"$designSystemId","componentId":"$privateComponentId"}""")
                }
                assertEquals(HttpStatusCode.Created, privateLink.status)
                val privateState = client.post("/api/ds/states") {
                    trustedSystemAdmin()
                    jsonBody("""{"componentId":"$privateComponentId","name":"private-state"}""")
                }
                assertEquals(HttpStatusCode.Created, privateState.status)
                val privateStateId = id(privateState.bodyAsText())
                val privateStateSet = client.post("/api/ds/state-sets/resolve") {
                    trustedSystemAdmin()
                    jsonBody("""{"stateIds":["$privateStateId"]}""")
                }
                assertTrue(
                    privateStateSet.status == HttpStatusCode.OK || privateStateSet.status == HttpStatusCode.Created,
                )
                val privateStateSetId = id(privateStateSet.bodyAsText())
                assertEquals(
                    HttpStatusCode.NotFound,
                    client.get("/api/ds/states/$privateStateId") { trusted("project-b", "viewer") }.status,
                )
                assertEquals(
                    HttpStatusCode.NotFound,
                    client.get("/api/ds/state-sets/$privateStateSetId") { trusted("project-b", "viewer") }.status,
                )

                val chunkedOversize = client.post("/api/ds/component-config/import") {
                    trusted("project-a", "editor")
                    contentType(ContentType.Application.Json)
                    setBody(ByteReadChannel("x".repeat(16 * 1024 * 1024 + 1).encodeToByteArray()))
                }
                assertEquals(HttpStatusCode.PayloadTooLarge, chunkedOversize.status)

                val deleted = client.delete("/api/ds/design-systems/$designSystemId") {
                    trusted("project-a", "owner")
                }
                assertEquals(HttpStatusCode.OK, deleted.status)
                assertFalse(exists(postgres, "design_systems", designSystemId))
            }
        }
    }

    private fun seedComponentPrerequisites(postgres: PostgreSQLContainer<Nothing>): Map<String, UUID> {
        val root = requireNotNull(javaClass.getResourceAsStream("/component-seeds.json"))
            .bufferedReader().use { json.parseToJsonElement(it.readText()).jsonObject }
        val componentIds = linkedMapOf<String, UUID>()
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            root.getValue("components").jsonArray.forEach { element ->
                val component = element.jsonObject
                val componentName = component.getValue("name").jsonPrimitive.content
                val componentId = connection.prepareStatement(
                    "INSERT INTO components (name, description) VALUES (?, '') RETURNING id",
                ).use { statement ->
                    statement.setString(1, componentName)
                    statement.executeQuery().use { rows ->
                        rows.next()
                        rows.getObject(1, UUID::class.java)
                    }
                }
                componentIds[componentName] = componentId
                val propertyNames = linkedSetOf<String>()
                component.getValue("propertyVariations").jsonArray.forEach {
                    propertyNames += it.jsonObject.getValue("property").jsonPrimitive.content
                }
                collectPropertyNames(component.getValue("appearances"), propertyNames)
                propertyNames.forEach { propertyName ->
                    val propertyId = connection.prepareStatement(
                        "INSERT INTO properties (component_id, name, type) " +
                            "VALUES (?, ?, 'value'::property_type) RETURNING id",
                    ).use { statement ->
                        statement.setObject(1, componentId)
                        statement.setString(2, propertyName)
                        statement.executeQuery().use { rows ->
                            rows.next()
                            rows.getObject(1, UUID::class.java)
                        }
                    }
                    val params = linkedSetOf<Pair<String, String>>()
                    collectAdjustments(component.getValue("appearances"), propertyName, params)
                    params.forEach { (platform, name) ->
                        connection.prepareStatement(
                            "INSERT INTO property_platform_params (property_id, platform, name) " +
                                "VALUES (?, ?::property_platform, ?)",
                        ).use { statement ->
                            statement.setObject(1, propertyId)
                            statement.setString(2, platform)
                            statement.setString(3, name)
                            statement.executeUpdate()
                        }
                    }
                }
            }
        }
        return componentIds
    }

    private suspend fun verifyThemeCreationWithoutComponentMetadata(
        client: HttpClient,
        postgres: PostgreSQLContainer<Nothing>,
    ) {
        val designSystem = client.post("/api/ds/design-systems") {
            trusted("project-a", "owner")
            jsonBody("""{"name":"missing-prerequisites","projectName":"alpha"}""")
        }
        assertEquals(HttpStatusCode.Created, designSystem.status)
        val designSystemId = id(designSystem.bodyAsText())
        val tenant = client.post("/api/ds/tenants") {
            trusted("project-a", "editor")
            jsonBody("""{"designSystemId":"$designSystemId","name":"without-components"}""")
        }
        assertEquals(HttpStatusCode.Created, tenant.status, tenant.bodyAsText())
        assertEquals(1, rowCount(postgres, "design_systems"))
        assertTrue(rowCount(postgres, "tokens") > 0)
        assertEquals(1, rowCount(postgres, "tenants"))
        assertTrue(rowCount(postgres, "token_values") > 0)
        assertEquals(0, rowCount(postgres, "design_system_components"))
        assertEquals(0, rowCount(postgres, "appearances"))
        val deleted = client.delete("/api/ds/design-systems/$designSystemId") {
            trusted("project-a", "owner")
        }
        assertEquals(HttpStatusCode.OK, deleted.status)
        assertEquals(0, rowCount(postgres, "design_systems"))
        assertEquals(0, rowCount(postgres, "tokens"))
    }

    private fun collectPropertyNames(value: JsonElement, target: MutableSet<String>) {
        when (value) {
            is JsonArray -> value.forEach { collectPropertyNames(it, target) }
            is JsonObject -> {
                value["prop"]?.jsonPrimitive?.content?.let(target::add)
                value.values.forEach { collectPropertyNames(it, target) }
            }
            else -> Unit
        }
    }

    private fun collectAdjustments(
        value: JsonElement,
        propertyName: String,
        target: MutableSet<Pair<String, String>>,
        currentProperty: String? = null,
    ) {
        when (value) {
            is JsonArray -> value.forEach { collectAdjustments(it, propertyName, target, currentProperty) }
            is JsonObject -> {
                val property = value["prop"]?.jsonPrimitive?.content ?: currentProperty
                if (property == propertyName) {
                    value["adjust"]?.jsonArray?.forEach { adjustment ->
                        val entry = adjustment.jsonObject
                        target += entry.getValue("platform").jsonPrimitive.content to
                            entry.getValue("param").jsonPrimitive.content
                    }
                }
                value.values.forEach { collectAdjustments(it, propertyName, target, property) }
            }
            else -> Unit
        }
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

    private fun HttpRequestBuilder.trustedSystemAdmin() {
        header("X-Actor-Type", "user")
        header("X-User-Id", "integration-admin")
        header("X-Project-Id", "global")
        header("X-System-Admin", "true")
    }

    private fun HttpRequestBuilder.jsonBody(value: String) {
        contentType(ContentType.Application.Json)
        setBody(value)
    }

    private fun id(body: String): String = json.parseToJsonElement(body).jsonObject.getValue("id").jsonPrimitive.content

    private fun importBody(designSystemId: String, styleName: String, dryRun: Boolean) =
        """
        {
          "designSystemId":"$designSystemId",
          "meta":{"name":"integration-fixture","source":"kotlin-test"},
          "dryRun":$dryRun,
          "components":[{
            "componentName":"button",
            "styleName":"$styleName",
            "config":{
              "invariants":{
                "shape":{
                  "type":"value",
                  "value":{"radius":8},
                  "states":[{"state":["pressed"],"type":"value","value":{"radius":10}}]
                }
              }
            }
          }]
        }
        """.trimIndent()

    private fun counts(postgres: PostgreSQLContainer<Nothing>): Map<String, Int> =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            listOf("appearances", "invariant_property_values", "design_system_changes").associateWith { table ->
                connection.createStatement().use { statement ->
                    statement.executeQuery("SELECT count(*) FROM $table").use { rows ->
                        rows.next()
                        rows.getInt(1)
                    }
                }
            }
        }

    private fun exists(postgres: PostgreSQLContainer<Nothing>, table: String, id: String): Boolean =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.prepareStatement("SELECT EXISTS(SELECT 1 FROM $table WHERE id = ?::uuid)").use { statement ->
                statement.setString(1, id)
                statement.executeQuery().use { rows -> rows.next() && rows.getBoolean(1) }
            }
        }

    private fun rowCount(postgres: PostgreSQLContainer<Nothing>, table: String): Int =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery("SELECT count(*) FROM $table").use { rows ->
                    rows.next()
                    rows.getInt(1)
                }
            }
        }

    private companion object {
        const val MISSING_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff"
    }
}
