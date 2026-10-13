package com.dsbuilder.ds.components.data

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.security.MessageDigest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ComponentSeedsResourceTest {
    @Test
    fun `canonical component configurations contain references but no property definitions`() {
        val bytes = requireNotNull(javaClass.getResourceAsStream("/component-seeds.json")).use { it.readBytes() }
        val root = Json.parseToJsonElement(bytes.decodeToString()).jsonObject
        val components = root.getValue("components").jsonArray

        assertEquals("779429beecae381cc05df39c8c19d0dcc2397344c69f2acffbaca4954d8e5c38", bytes.sha256())
        assertEquals(63, components.size)
        assertEquals(21, root.getValue("dependencies").jsonArray.size)
        assertEquals(66, components.sumOf { it.jsonObject.getValue("appearances").jsonArray.size })
        assertTrue(
            components.all { component ->
                val value = component.jsonObject
                "properties" !in value && value.getValue("name").jsonPrimitive.content.isNotBlank()
            },
        )
        assertFalse(components.flatMap { it.jsonObject.getValue("propertyVariations").jsonArray }.isEmpty())
    }

    private fun ByteArray.sha256(): String = MessageDigest.getInstance("SHA-256")
        .digest(this)
        .joinToString("") { byte -> "%02x".format(byte) }
}
