package com.dsbuilder.frontend.mcpserver

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put

/** Строит закрытую JSON-схему объекта для обоих средств запуска. */
internal fun inputObjectSchema(properties: Map<String, McpToolInputDefinition>): JsonObject = buildJsonObject {
    put("type", "object")
    put("properties", JsonObject(properties.mapValues { it.value.toJsonSchema() }))
    put("required", JsonArray(properties.filterValues { it.required }.keys.map(::JsonPrimitive)))
    put("additionalProperties", false)
}

internal fun McpToolInputDefinition.toJsonSchema(): JsonObject = buildJsonObject {
    if (type != "json") {
        put(
            "type",
            if (nullable) {
                JsonArray(
                    listOf(
                        JsonPrimitive(type),
                        JsonPrimitive("null"),
                    ),
                )
            } else {
                JsonPrimitive(type)
            },
        )
    }
    description?.let { put("description", it) }
    if (allowedValues.isNotEmpty()) {
        put(
            "enum",
            buildJsonArray {
                allowedValues.forEach { add(JsonPrimitive(it)) }
                if (nullable) add(JsonNull)
            },
        )
    }
    if (type == "object") {
        inputObjectSchema(properties).forEach { (key, value) -> if (key != "type") put(key, value) }
    }
    val itemSchema = items ?: itemType?.let { McpToolInputDefinition(type = it) }
    itemSchema?.let { put("items", it.toJsonSchema()) }
}

/** Проверяет вложенные аргументы до вызова предметного адаптера. */
internal fun inputObjectError(
    value: JsonObject,
    properties: Map<String, McpToolInputDefinition>,
    path: String = "arguments",
): String? {
    value.keys.firstOrNull { it !in properties }?.let { return "Unsupported field: $path.$it" }
    properties.entries.firstOrNull { it.value.required && it.key !in value }
        ?.let { return "Required field: $path.${it.key}" }
    return value.entries.firstNotNullOfOrNull { (name, input) ->
        inputError(input, properties.getValue(name), "$path.$name")
    }
}

internal fun inputError(value: JsonElement, schema: McpToolInputDefinition, path: String): String? {
    if (value == JsonNull) return if (schema.nullable) null else "Null is not allowed: $path"
    return when (schema.type) {
        "json" -> null
        "object" -> if (value is JsonObject) {
            inputObjectError(
                value,
                schema.properties,
                path,
            )
        } else {
            "Invalid object: $path"
        }
        "array" -> {
            if (value !is JsonArray) return "Invalid array: $path"
            val itemSchema = schema.items ?: schema.itemType?.let { McpToolInputDefinition(type = it) }
            value.withIndex().firstNotNullOfOrNull { (index, item) ->
                itemSchema?.let { inputError(item, it, "$path[$index]") }
            }
        }
        else -> primitiveError(value, schema, path)
    }
}

private fun primitiveError(value: JsonElement, schema: McpToolInputDefinition, path: String): String? {
    val primitive = value as? JsonPrimitive ?: return "Invalid value: $path"
    val valid = when (schema.type) {
        "string" ->
            primitive.isString &&
                (schema.allowedValues.isEmpty() || primitive.content in schema.allowedValues)
        "integer" -> !primitive.isString && primitive.longOrNull != null
        "number" -> !primitive.isString && primitive.doubleOrNull?.isFinite() == true
        "boolean" -> !primitive.isString && primitive.booleanOrNull != null
        else -> false
    }
    return if (valid) null else "Invalid ${schema.type}: $path"
}
