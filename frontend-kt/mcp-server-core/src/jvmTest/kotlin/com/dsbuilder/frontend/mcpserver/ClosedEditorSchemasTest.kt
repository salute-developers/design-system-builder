package com.dsbuilder.frontend.mcpserver

import kotlinx.io.Buffer
import kotlinx.io.readString
import kotlinx.io.writeString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

class ClosedEditorSchemasTest {
    @Test
    fun largeToolListSurvivesFragmentedWritesAndUtf8WithLegacySchemasIntact() {
        val schema = buildJsonObject { put("type", "object") }
        val message = buildJsonObject {
            put("jsonrpc", "2.0")
            put("id", 2)
            put(
                "result",
                buildJsonObject {
                    put(
                        "tools",
                        buildJsonArray {
                            add(
                                buildJsonObject {
                                    put("name", "token_update")
                                    put("description", "Цвет".repeat(10000))
                                    put("inputSchema", schema)
                                },
                            )
                            add(
                                buildJsonObject {
                                    put("name", "project_get_status")
                                    put("inputSchema", schema)
                                },
                            )
                        },
                    )
                },
            )
        }
        val bytes = message.toString().encodeToByteArray()
        val output = Buffer()
        val sink = closedEditorSchemaSink(output)
        for (start in bytes.indices step 1001) {
            sink.write(bytes, start, minOf(start + 1001, bytes.size))
            sink.flush()
        }
        assertEquals(0, output.size)
        sink.writeString("\n")
        sink.flush()
        val actual = Json.parseToJsonElement(output.readString()).jsonObject
        val tools = actual.getValue("result").jsonObject.getValue("tools").jsonArray
        val editor = tools[0].jsonObject
        assertEquals(message["id"], actual["id"])
        assertEquals("Цвет".repeat(10000), (editor["description"] as JsonPrimitive).content)
        assertEquals(JsonPrimitive(false), editor.getValue("inputSchema").jsonObject["additionalProperties"])
        assertFalse("additionalProperties" in tools[1].jsonObject.getValue("inputSchema").jsonObject)
    }

    @Test
    fun ordinaryMessagesAndFinalPartialBytesPassThroughUnchanged() {
        val output = Buffer()
        val sink = closedEditorSchemaSink(output)
        val text = "{\"jsonrpc\":\"2.0\",\"result\":{\"tools\":\"literal\"}}\n"
        sink.writeString(text)
        sink.writeString("partial")
        sink.close()
        assertEquals(text + "partial", output.readString())
        assertEquals("not json\n", closeEditorToolSchemas("not json\n"))
    }
}
