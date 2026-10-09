package com.dsbuilder.ds.app

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.yaml.snakeyaml.Yaml

/** Loads the reviewed static OpenAPI contract bundled with the service. */
class OpenApiDocumentResource(private val json: Json) {
    /** Stable operation metadata used by OpenAPI, readiness and bounded telemetry. */
    fun operations(): List<PublishedOperation> {
        return create().getValue("paths").jsonObject.flatMap { (path, pathItem) ->
            pathItem.jsonObject.mapNotNull { (method, operation) ->
                operation.jsonObject["x-permission"]?.jsonPrimitive?.content?.let { permission ->
                    PublishedOperation(method.uppercase(), path, permission)
                }
            }
        }
    }

    /** Permissions referenced by every published operation. */
    fun permissions(): Set<String> = operations().mapTo(linkedSetOf(), PublishedOperation::permission)

    /** Returns the static OpenAPI document served by the running service. */
    fun create(): JsonObject = loadYamlResource("openapi/documentation.yaml")

    private fun loadYamlResource(path: String): JsonObject {
        val resource = requireNotNull(javaClass.classLoader.getResourceAsStream(path)) {
            "OpenAPI contract resource is missing: $path"
        }
        val document = resource.bufferedReader().use { Yaml().load<Any?>(it) }
        return yamlElement(document).jsonObject
    }

    private fun yamlElement(value: Any?): JsonElement = when (value) {
        null -> JsonNull
        is Map<*, *> -> JsonObject(value.entries.associate { (key, item) -> key.toString() to yamlElement(item) })
        is List<*> -> JsonArray(value.map(::yamlElement))
        is Boolean -> JsonPrimitive(value)
        is Number -> JsonPrimitive(value)
        else -> JsonPrimitive(value.toString())
    }
}
