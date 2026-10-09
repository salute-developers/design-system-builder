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

        assertEquals("6414d9bc4710b28f4d498fb6da47fc4bcaf433fb1c8f8b25661f5def56c75f4a", bytes.sha256())
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
