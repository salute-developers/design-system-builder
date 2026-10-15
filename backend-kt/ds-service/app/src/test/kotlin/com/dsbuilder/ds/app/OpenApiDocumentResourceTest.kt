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
        assertEquals(
            setOf("ds", "version", "appearance", "component", "platform"),
            queryParameters.map {
                it.jsonObject.getValue("name").jsonPrimitive.content
            }.toSet(),
        )
    }
}
