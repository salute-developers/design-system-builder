package com.dsbuilder.ds.core.presentation

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class MutationMetadataHeadersTest {
    @Test
    fun `small metadata remains complete`() {
        val metadata = """[{"entityType":"token","revision":1,"warnings":[]}]"""
        val (value, truncated) = MutationMetadataHeaders.encode(metadata)
        assertEquals(metadata, value)
        assertEquals(Json.parseToJsonElement(metadata), Json.parseToJsonElement(value))
        assertFalse(truncated)
    }

    @Test
    fun `large metadata stays valid json within utf8 byte budget`() {
        val entries = (1..100).map { index ->
            JsonObject(mapOf("entityId" to JsonPrimitive(index), "path" to JsonPrimitive("Цвет".repeat(30))))
        }
        val (value, truncated) = MutationMetadataHeaders.encode(JsonArray(entries).toString())
        val selected = Json.parseToJsonElement(value).jsonArray
        assertTrue(truncated)
        assertTrue(value.encodeToByteArray().size <= MutationMetadataHeaders.MAX_BYTES)
        assertTrue(selected.isNotEmpty())
        assertEquals(entries.take(selected.size), selected.toList())
    }

    @Test
    fun `single oversized entry produces explicit incomplete empty array`() {
        val input = JsonArray(listOf(JsonObject(mapOf("path" to JsonPrimitive("x".repeat(4096))))))
        assertEquals("[]" to true, MutationMetadataHeaders.encode(input.toString()))
    }
}
