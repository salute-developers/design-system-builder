package com.dsbuilder.ds.app

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Contract tests for the static OpenAPI allowlist. */
class OpenApiDocumentResourceTest {
    private val document = OpenApiDocumentResource(Json).create()
    private val paths = document.getValue("paths").jsonObject

    /** Every manifest operation is represented exactly once. */
    @Test
    fun `contains the complete included operation set`() {
        val operationCount = paths.values.sumOf { it.jsonObject.size }

        assertEquals(177, operationCount)
        assertTrue("/api/ds/design-systems" in paths)
        assertTrue("/api/ds/component-config/import" in paths)
        assertTrue("/api/ds/component-config/web-adapter" in paths)
    }

    /** Операции групп манифеста с `origin: ds-service` есть в документе с тем же методом и правом. */
    @Test
    fun `ds-service operations of the manifest match the document`() {
        val manifest = Json.parseToJsonElement(File("../contracts/route-manifest.json").readText()).jsonObject
        val prefix = manifest.getValue("internalPrefix").jsonPrimitive.content
        val expected = manifest.getValue("groups").jsonArray
            .map { it.jsonObject }
            .filter { it["origin"]?.jsonPrimitive?.content == "ds-service" }
            .flatMap { group -> group.getValue("operations").jsonArray.map { it.jsonArray } }
            .map { operation ->
                Triple(
                    operation[0].jsonPrimitive.content.lowercase(),
                    prefix + operation[1].jsonPrimitive.content,
                    operation[5].jsonPrimitive.content,
                )
            }
        assertTrue(expected.any { (_, path) -> path == "/api/ds/tenants/{tenantId}/color-tokens" })
        expected.forEach { (method, path, permission) ->
            val operation = paths[path]?.jsonObject?.get(method)?.jsonObject
            assertEquals(permission, operation?.get("x-permission")?.jsonPrimitive?.content, "$method $path")
        }
    }

    /** Excluded route families cannot leak into the ds-service contract. */
    @Test
    fun `does not publish excluded routes`() {
        val routeNames = paths.keys.joinToString("\n")

        assertFalse("legacy" in routeNames)
        assertFalse("admin" in routeNames)
        assertFalse("documentation-pages" in routeNames)
        assertFalse("generate" in routeNames)
        assertFalse("/api/ds/design-system-changes" in routeNames)
        assertFalse("patch" in paths.getValue("/api/ds/design-system-versions/{id}").jsonObject)
        assertFalse("delete" in paths.getValue("/api/ds/design-system-versions/{id}").jsonObject)
        listOf(
            "/api/ds/components/{id}",
            "/api/ds/component-deps/{id}",
            "/api/ds/properties/{id}",
            "/api/ds/variations/{id}",
            "/api/ds/property-platform-params/{id}",
            "/api/ds/property-variations/{id}",
            "/api/ds/states/{id}",
        ).forEach { path -> assertFalse("delete" in paths.getValue(path).jsonObject, path) }
    }

    /** DTO schemas and route parameters are inherited from the legacy contract, not emitted as placeholders. */
    @Test
    fun `publishes explicit schemas and parameters`() {
        val schemas = document.getValue("components").jsonObject.getValue("schemas").jsonObject
        assertTrue(schemas.getValue("DesignSystem").jsonObject.getValue("properties").jsonObject.isNotEmpty())

        val idParameters = paths.getValue("/api/ds/design-systems/{id}").jsonObject
            .getValue("get").jsonObject.getValue("parameters").jsonArray
        assertTrue(idParameters.any { it.jsonObject["name"]?.jsonPrimitive?.content == "id" })

        val queryParameters = paths.getValue("/api/ds/component-config").jsonObject
            .getValue("get").jsonObject.getValue("parameters").jsonArray
        assertTrue(
            queryParameters.any { it.jsonObject["\$ref"]?.jsonPrimitive?.content?.endsWith("/VersionId") == true },
        )
        assertEquals(
            setOf("ds", "version", "appearance", "component", "platform"),
            queryParameters.mapNotNull {
                it.jsonObject["name"]?.jsonPrimitive?.content
            }.toSet(),
        )

        listOf(
            "/api/ds/tokens" to "post",
            "/api/ds/appearances/{id}" to "patch",
            "/api/ds/style-combinations/{id}" to "delete",
            "/api/ds/component-config/import" to "post",
        ).forEach { (path, method) ->
            val operation = paths.getValue(path).jsonObject.getValue(method).jsonObject
            val parameters = operation.getValue("parameters").jsonArray
            assertTrue(
                parameters.any { it.jsonObject["\$ref"]?.jsonPrimitive?.content?.endsWith("/BaseRevision") == true },
                "$method $path",
            )
            val success = operation.getValue("responses").jsonObject.entries
                .first { it.key.startsWith("2") }.value.jsonObject
            assertTrue("X-DS-Mutation-Metadata" in success.getValue("headers").jsonObject, "$method $path")
        }
    }

    /** Required fields cannot refer to properties absent from the same concrete schema. */
    @Test
    fun `schema required fields are declared`() {
        val schemas = document.getValue("components").jsonObject.getValue("schemas").jsonObject
        schemas.forEach { (name, element) ->
            val schema = element.jsonObject
            val properties = schema["properties"]?.jsonObject ?: return@forEach
            val required = schema["required"]?.jsonArray?.map { it.jsonPrimitive.content }.orEmpty()
            assertTrue(required.all(properties::containsKey), "$name has undeclared required properties")
        }

        val tenantValues = paths.getValue("/api/ds/tenants/{id}/token-values").jsonObject
        listOf("get", "put").forEach { method ->
            val response = tenantValues.getValue(method).jsonObject.getValue("responses").jsonObject.getValue("200")
            assertTrue(response.toString().contains("TenantTokenValue"), method)
        }

        fun required(name: String) = schemas.getValue(name).jsonObject.getValue("required").jsonArray
            .map { it.jsonPrimitive.content }.toSet()
        assertEquals(
            setOf(
                "id", "tokenId", "tenantId", "paletteId", "platform", "mode", "value", "createdAt", "updatedAt",
            ),
            required("TokenValue"),
        )
        assertEquals(
            setOf(
                "changeId", "versionId", "entityType", "entityId", "operation", "changedPaths",
                "previousValue", "currentValue", "actorId", "changedAt", "editRevision",
            ),
            required("DraftChange"),
        )
        assertTrue("preview" in required("Tenant"))
    }
}
