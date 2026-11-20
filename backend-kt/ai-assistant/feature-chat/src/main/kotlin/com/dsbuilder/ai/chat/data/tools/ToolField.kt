package com.dsbuilder.ai.chat.data.tools

import com.dsbuilder.ai.chat.application.ChatToolDefinition
import com.dsbuilder.ai.chat.application.ChatToolKind
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Поле схемы аргументов инструмента. */
internal class ToolField(val name: String, val schema: JsonObject, val required: Boolean)

/** Строковое поле. */
internal fun text(name: String, description: String, required: Boolean = true) =
    field(name, "string", description, required)

/** Целочисленное поле. */
internal fun integer(name: String, description: String, required: Boolean = true) =
    field(name, "integer", description, required)

/** Числовое поле. */
internal fun number(name: String, description: String, required: Boolean = true) =
    field(name, "number", description, required)

/** Логическое поле. */
internal fun flag(name: String, description: String, required: Boolean = true) =
    field(name, "boolean", description, required)

/** Поле с произвольной JSON-схемой [schema]. */
internal fun custom(name: String, schema: JsonObject, required: Boolean = true) = ToolField(name, schema, required)

private fun field(name: String, type: String, description: String, required: Boolean) = ToolField(
    name,
    buildJsonObject {
        put("type", type)
        put("description", description)
    },
    required,
)

/** Описание инструмента с объектной схемой из [fields]. */
internal fun tool(
    name: String,
    description: String,
    permission: String,
    kind: ChatToolKind,
    vararg fields: ToolField,
) = ChatToolDefinition(
    name = name,
    description = description,
    inputSchema = buildJsonObject {
        put("type", "object")
        put("properties", JsonObject(fields.associate { it.name to it.schema }))
        put("required", JsonArray(fields.filter { it.required }.map { JsonPrimitive(it.name) }))
    },
    permission = permission,
    kind = kind,
)

/** Проверяет аргументы по схеме инструмента: обязательные поля и типы верхнего уровня. */
internal fun ChatToolDefinition.accepts(arguments: JsonObject): Boolean {
    val properties = inputSchema["properties"] as? JsonObject ?: return true
    val required = (inputSchema["required"] as? JsonArray).orEmpty().map { (it as JsonPrimitive).content }
    if (required.any { arguments[it] == null || arguments[it] is kotlinx.serialization.json.JsonNull }) return false
    return arguments.all { (key, value) ->
        val type = ((properties[key] as? JsonObject)?.get("type") as? JsonPrimitive)?.content
        type == null || value is kotlinx.serialization.json.JsonNull || value.matches(type)
    }
}

private fun JsonElement.matches(type: String): Boolean = typeChecks[type]?.invoke(this) ?: true

private fun JsonElement.scalar(): JsonPrimitive? = (this as? JsonPrimitive)?.takeUnless { it.isString }

private val typeChecks: Map<String, (JsonElement) -> Boolean> = mapOf(
    "string" to { it is JsonPrimitive && it.isString },
    "integer" to { it.scalar()?.content?.toLongOrNull() != null },
    "number" to { it.scalar()?.content?.toDoubleOrNull() != null },
    "boolean" to { it.scalar()?.content in setOf("true", "false") },
    "object" to { it is JsonObject },
    "array" to { it is JsonArray },
)
