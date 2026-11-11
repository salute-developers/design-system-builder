package com.dsbuilder.frontend.mcpserver

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class McpInputSchemaTest {
    private val schema = mapOf(
        "members" to McpToolInputDefinition(
            type = "array",
            required = true,
            items = McpToolInputDefinition(
                type = "object",
                properties = mapOf(
                    "id" to McpToolInputDefinition(required = true),
                    "value" to McpToolInputDefinition(nullable = true, allowedValues = listOf("color")),
                    "revision" to McpToolInputDefinition(type = "integer", required = true),
                ),
            ),
        ),
    )

    @Test
    fun schemaClosesObjectsAndPreservesNestedRequiredAndNullability() {
        val root = inputObjectSchema(schema)
        assertEquals(JsonPrimitive(false), root["additionalProperties"])
        val member = root.getValue("properties").jsonObject.getValue("members").jsonObject
            .getValue("items").jsonObject
        assertEquals(JsonPrimitive(false), member["additionalProperties"])
        assertEquals(JsonArray(listOf(JsonPrimitive("id"), JsonPrimitive("revision"))), member["required"])
        val value = member.getValue("properties").jsonObject.getValue("value").jsonObject
        assertEquals(JsonArray(listOf(JsonPrimitive("string"), JsonPrimitive("null"))), value["type"])
        assertEquals(JsonArray(listOf(JsonPrimitive("color"), JsonNull)), value["enum"])
    }

    @Test
    fun validationDistinguishesNullMissingWrongTypeAndUnknownNestedFields() {
        assertNull(errorFor("""{"members":[{"id":"a","revision":7,"value":null}]}"""))
        for (input in listOf(
            """{"members":[{"revision":7}]}""",
            """{"members":[{"id":null,"revision":7}]}""",
            """{"members":[{"id":"a","revision":"7"}]}""",
            """{"members":[{"id":"a","revision":7,"other":true}]}""",
            """{"members":[{"id":"a","revision":7,"value":"unknown"}]}""",
            """{"members":{},"other":true}""",
        )) assertNotNull(errorFor(input), input)
    }

    @Test
    fun optionalJsonValueSchemaExcludesNullWithoutRestrictingOtherJsonKinds() {
        val fields = editorTokenTools.single { it.name == "token_value_update" }.inputSchema
        val root = inputObjectSchema(fields)
        val value = root.getValue("properties").jsonObject.getValue("value").jsonObject
        assertEquals(JsonPrimitive("null"), value.getValue("not").jsonObject.getValue("type"))
        assertNull(value["type"])
        assertEquals(false, root.getValue("required").jsonArray.contains(JsonPrimitive("value")))
        assertNull(
            inputObjectError(Json.parseToJsonElement("""{"valueId":"v","idempotencyKey":"k"}""").jsonObject, fields),
        )
    }

    private fun errorFor(input: String): String? =
        inputObjectError(Json.parseToJsonElement(input) as JsonObject, schema)
}
