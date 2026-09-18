package com.dsbuilder.frontend.mcpserver

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull

class McpResponseProjectionsTest {
    @Test
    fun searchKeepsCursorAndDropsOnlyBindingPayload() {
        val json = Json
        val input = McpToolResult(
            false,
            """
            {
              "source":"documentation",
              "data":{
                "items":[{
                  "id":"b-1",
                  "subject":"components.basic-button",
                  "kind":"component-style",
                  "name":"BasicButton",
                  "platform":"compose",
                  "platformPayload":{"styles":[1,2]}
                }],
                "nextCursor":"next"
              }
            }
            """.trimIndent(),
        )

        val output = compactBindingSearch(json, input)
        val page = json.parseToJsonElement(output.body).jsonObject.getValue("data").jsonObject
        val binding = page.getValue("items").jsonArray.single().jsonObject

        assertEquals("next", page.getValue("nextCursor").jsonPrimitive.content)
        assertEquals("b-1", binding.getValue("id").jsonPrimitive.content)
        assertFalse(binding.containsKey("platformPayload"))
    }

    @Test
    fun selectionSyntaxRejectsDuplicates() {
        assertNull(parseVariationSelection("size=s,size=xl"))
        assertNull(parseVariationSelection("size"))
        assertEquals(mapOf("size" to "s"), parseVariationSelection("size=s"))
    }
}
