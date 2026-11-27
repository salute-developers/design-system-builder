package com.dsbuilder.ds.app

import com.dsbuilder.ds.core.application.DsPublicReadKind
import com.dsbuilder.ds.core.application.DsReadOperation
import com.dsbuilder.ds.core.application.DsReadOperationCatalog
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
    private val document by lazy { loadYamlResource("dsbuilder/ds/openapi/documentation.yaml") }

    /** Общий каталог разрешённых чтений для шлюза и транзакционной границы. */
    fun publicReads(): DsReadOperationCatalog {
        val operations = create().getValue("paths").jsonObject.flatMap { (path, item) ->
            item.jsonObject.mapNotNull { (method, operation) ->
                val value = operation.jsonObject
                val kind = value["x-ds-public-read"]?.jsonPrimitive?.content ?: return@mapNotNull null
                DsReadOperation(
                    method.uppercase(),
                    path,
                    value.getValue("x-permission").jsonPrimitive.content,
                    DsPublicReadKind.valueOf(kind.uppercase().replace('-', '_')),
                )
            }
        }
        val shared = create().getValue("paths").jsonObject.mapNotNull { (path, item) ->
            val get = item.jsonObject["get"]?.jsonObject
            path.takeIf { get?.get("x-ds-public-resource")?.jsonPrimitive?.content == "true" }
        }.toSet()
        return DsReadOperationCatalog(operations, shared)
    }

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
    fun create(): JsonObject = document

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
