package com.dsbuilder.ds.app

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/** Builds the runtime OpenAPI allowlist directly from the reviewed route manifest. */
class OpenApiDocumentFactory(private val json: Json) {
    /** Stable operation metadata used by OpenAPI, readiness and bounded telemetry. */
    fun operations(): List<PublishedOperation> {
        val manifest = loadManifest()
        val prefix = manifest.getValue("internalPrefix").jsonPrimitive.content
        val fields = manifest.getValue("operationFields").jsonArray
            .mapIndexed { index, value -> value.jsonPrimitive.content to index }
            .toMap()
        return manifest.getValue("groups").jsonArray.flatMap { group ->
            group.jsonObject.getValue("operations").jsonArray.map { element ->
                val operation = element.jsonArray
                PublishedOperation(
                    operation.value(fields, "method"),
                    prefix + operation.value(fields, "suffix"),
                    operation.value(fields, "permission"),
                )
            }
        }
    }

    /** Permissions referenced by every published operation. */
    fun permissions(): Set<String> = operations().mapTo(linkedSetOf(), PublishedOperation::permission)

    /** Returns an OpenAPI document containing every and only manifest operation. */
    fun create(): JsonObject {
        val manifest = loadManifest()
        val internalPrefix = manifest.getValue("internalPrefix").jsonPrimitive.content
        val fields = manifest.getValue("operationFields").jsonArray
            .mapIndexed { index, value -> value.jsonPrimitive.content to index }
            .toMap()
        val legacy = loadJsonResource("contracts/db-service-openapi.json")
        val legacyPaths = legacy.getValue("paths").jsonObject
        val paths = linkedMapOf<String, MutableMap<String, JsonObject>>()
        manifest.getValue("groups").jsonArray.forEach { groupElement ->
            val group = groupElement.jsonObject
            group.getValue("operations").jsonArray.forEach { operationElement ->
                val operation = operationElement.jsonArray
                val method = operation.value(fields, "method").lowercase()
                val suffix = operation.value(fields, "suffix")
                val permission = operation.value(fields, "permission")
                val legacyOperation = requireNotNull(legacyPaths["/ds$suffix"]?.jsonObject?.get(method)) {
                    "legacy OpenAPI operation is missing: $method /ds$suffix"
                }.jsonObject
                paths.getOrPut(internalPrefix + suffix, ::linkedMapOf)[method] = JsonObject(
                    legacyOperation + ("x-permission" to JsonPrimitive(permission)),
                )
            }
        }
        return buildJsonObject {
            put("openapi", "3.0.3")
            put(
                "info",
                buildJsonObject {
                    put("title", "DS Builder Design System API")
                    put("version", "1.0.0")
                },
            )
            put("paths", JsonObject(paths.mapValues { JsonObject(it.value) }))
            put("components", legacy.getValue("components"))
        }
    }

    private fun loadManifest(): JsonObject = loadJsonResource("contracts/route-manifest.json")

    private fun loadJsonResource(path: String): JsonObject {
        val resource = requireNotNull(javaClass.classLoader.getResourceAsStream(path)) {
            "JSON contract resource is missing: $path"
        }
        return resource.bufferedReader().use { json.parseToJsonElement(it.readText()).jsonObject }
    }
}

private fun JsonArray.value(fields: Map<String, Int>, name: String): String =
    getValueAt(fields, name).jsonPrimitive.content

private fun JsonArray.getValueAt(fields: Map<String, Int>, name: String) =
    get(requireNotNull(fields[name]) { "manifest field is missing: $name" })
