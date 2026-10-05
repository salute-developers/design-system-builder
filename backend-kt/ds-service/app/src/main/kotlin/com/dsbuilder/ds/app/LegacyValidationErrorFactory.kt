package com.dsbuilder.ds.app

import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receiveNullable
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.MissingFieldException
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.util.UUID

/** Reproduces the Zod `flattenError` envelope for Kotlin deserialization failures. */
class LegacyValidationErrorFactory(
    openApi: JsonObject,
) {
    private val schemas = openApi.getValue("components").jsonObject.getValue("schemas").jsonObject
    private val paths = openApi.getValue("paths").jsonObject

    /** Builds field errors for all fields reported missing by kotlinx.serialization. */
    @OptIn(ExperimentalSerializationApi::class)
    fun missingFields(call: ApplicationCall, cause: Throwable): JsonObject? {
        val missing = cause.causes().filterIsInstance<MissingFieldException>().firstOrNull()?.missingFields
            ?: return null
        return validate(call, JsonObject(emptyMap()), missing)
    }

    /** Validates the cached JSON body using the legacy OpenAPI/Zod constraints. */
    suspend fun invalidBody(call: ApplicationCall): JsonObject? {
        val body = runCatching { call.receiveNullable<JsonObject>() }.getOrNull() ?: return null
        return validate(call, body)
    }

    /** Revalidates the cached request body after kotlinx.serialization rejects a DTO. */
    suspend fun fromBadRequest(call: ApplicationCall, cause: Throwable): JsonObject? =
        missingFields(call, cause) ?: invalidBody(call)

    private fun validate(
        call: ApplicationCall,
        body: JsonObject,
        deserializerMissing: List<String>? = null,
    ): JsonObject? {
        val schema = requestSchema(call) ?: return null
        val properties = schema["properties"]?.jsonObject.orEmpty()
        val required = schema["required"]?.let { element ->
            element as? JsonArray
        }?.mapTo(linkedSetOf()) { it.jsonPrimitive.content }.orEmpty()
        val missing = deserializerMissing ?: required.filterNot(body::containsKey)
        val errors = missing.filter { it in required }.associateWith { field ->
            missingMessage(properties[field]?.jsonObject?.resolved())
        }.toMutableMap()
        body.forEach { (field, value) ->
            val fieldSchema = properties[field]?.jsonObject?.resolved() ?: return@forEach
            presentMessage(fieldSchema, value)?.let { errors[field] = it }
        }
        return validationEnvelope(errors)
    }

    private fun missingMessage(schema: JsonObject?): List<String> {
        val enumValues = schema?.get("enum") as? JsonArray
        if (enumValues != null) return enumMessage(enumValues)
        val type = schema?.get("type")?.jsonPrimitive?.contentOrNull
            ?.let { if (it == "integer") "number" else it }
            ?: "value"
        return listOf("Invalid input: expected $type, received undefined")
    }

    private fun presentMessage(schema: JsonObject, value: JsonElement): List<String>? {
        val enumValues = schema["enum"] as? JsonArray
        val expected = schema["type"]?.jsonPrimitive?.contentOrNull
        val enumError = enumValues?.takeIf { value !in it }?.let(::enumMessage)
        val typeError = expected?.takeUnless { matchesType(it, value) }?.let {
            val zodExpected = if (expected == "integer") "number" else expected
            listOf("Invalid input: expected $zodExpected, received ${zodType(value)}")
        }
        val stringError = if (expected == "string" && isString(value)) stringMessage(schema, value) else null
        return enumError ?: typeError ?: stringError
    }

    private fun stringMessage(schema: JsonObject, value: JsonElement): List<String>? {
        val normalized = (value as JsonPrimitive).content.trim()
        val minLength = schema["minLength"]?.jsonPrimitive?.contentOrNull?.toIntOrNull()
        val maxLength = schema["maxLength"]?.jsonPrimitive?.contentOrNull?.toIntOrNull()
        return when {
            minLength != null && normalized.length < minLength ->
                listOf("Too small: expected string to have >=$minLength characters")
            maxLength != null && normalized.length > maxLength ->
                listOf("Too big: expected string to have <=$maxLength characters")
            schema["format"]?.jsonPrimitive?.contentOrNull == "uuid" &&
                runCatching { UUID.fromString(normalized) }.isFailure -> listOf("Must be a valid UUID")
            else -> null
        }
    }

    private fun matchesType(expected: String, value: JsonElement): Boolean = when (expected) {
        "string" -> isString(value)
        "integer" -> isInteger(value)
        "number" -> isNumber(value)
        "boolean" -> isBoolean(value)
        "array" -> value is JsonArray
        "object" -> value is JsonObject
        else -> true
    }

    private fun isString(value: JsonElement) = value is JsonPrimitive && value.isString

    private fun isInteger(value: JsonElement) =
        value is JsonPrimitive && !value.isString && value.content.toLongOrNull() != null

    private fun isNumber(value: JsonElement) =
        value is JsonPrimitive && !value.isString && value.content.toDoubleOrNull() != null

    private fun isBoolean(value: JsonElement) =
        value is JsonPrimitive && !value.isString && value.content in setOf("true", "false")

    private fun zodType(value: JsonElement): String = when (value) {
        JsonNull -> "null"
        is JsonArray -> "array"
        is JsonObject -> "object"
        is JsonPrimitive -> when {
            value.isString -> "string"
            value.content in setOf("true", "false") -> "boolean"
            value.content.toDoubleOrNull() != null -> "number"
            else -> "unknown"
        }
    }

    private fun enumMessage(values: JsonArray): List<String> {
        val expected = values.joinToString("|") { "\"${it.jsonPrimitive.content}\"" }
        return listOf("Invalid option: expected one of $expected")
    }

    private fun requestSchema(call: ApplicationCall): JsonObject? {
        val operation = paths[call.routeTemplate()]?.jsonObject
            ?.get(call.request.local.method.value.lowercase())?.jsonObject ?: return null
        val schema = operation["requestBody"]?.jsonObject
            ?.get("content")?.jsonObject
            ?.get("application/json")?.jsonObject
            ?.get("schema")?.jsonObject ?: return null
        return schema.resolved()
    }

    private fun JsonObject.resolved(): JsonObject {
        val reference = get("\$ref")?.jsonPrimitive?.contentOrNull ?: return this
        return schemas.getValue(reference.substringAfterLast('/')).jsonObject
    }

    private fun Throwable.causes(): Sequence<Throwable> = generateSequence(this, Throwable::cause)
}

internal fun validationEnvelope(fieldErrors: Map<String, List<String>>): JsonObject = buildJsonObject {
    put("formErrors", JsonArray(emptyList()))
    put(
        "fieldErrors",
        buildJsonObject {
            fieldErrors.forEach { (field, messages) ->
                put(field, buildJsonArray { messages.forEach { add(JsonPrimitive(it)) } })
            }
        },
    )
}
