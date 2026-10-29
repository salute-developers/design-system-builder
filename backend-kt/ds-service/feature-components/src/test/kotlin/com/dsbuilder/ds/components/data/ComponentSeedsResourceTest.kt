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

        assertEquals("b9e3453e07266c205b7e015ffe128af33783e3d67c9b9e5b2e9e79323108572f", bytes.sha256())
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

    @Test
    fun `list divider property follows the global metadata name`() {
        val text = requireNotNull(javaClass.getResourceAsStream("/component-seeds.json")).use { it.readBytes() }
            .decodeToString()
        val list = Json.parseToJsonElement(text).jsonObject.getValue("components").jsonArray
            .single { it.jsonObject.getValue("name").jsonPrimitive.content == "List" }.jsonObject
        val bound = list.getValue("propertyVariations").jsonArray
            .map { it.jsonObject.getValue("property").jsonPrimitive.content }

        assertTrue("listItemDividerHeight" in bound)
        assertFalse("listItemDividerWidth" in text)
    }

    @Test
    fun `properties without a web parameter are not referenced`() {
        val text = requireNotNull(javaClass.getResourceAsStream("/component-seeds.json")).use { it.readBytes() }
            .decodeToString()
        val components = Json.parseToJsonElement(text).jsonObject.getValue("components").jsonArray
            .associateBy { it.jsonObject.getValue("name").jsonPrimitive.content }
        // Удалены из сидов db-service вместе со значениями: у них нет web-параметра, а метаданные их не содержат.
        val removed = mapOf(
            "Button" to
                listOf("iconColor", "loadingAlpha", "paddingStart", "iconSize", "spinnerStrokeWidth", "valueStyle"),
            "IconButton" to listOf("loadingAlpha", "paddingEnd", "iconSize", "spinnerStrokeWidth"),
            "Checkbox" to listOf("toggleWidth", "toggleCheckedBorderWidth", "toggleIndeterminateIconColor"),
            "Radiobox" to listOf("toggleWidth", "ellipseWidth", "toggleCheckedBorderWidth"),
        )

        removed.forEach { (component, names) ->
            val json = components.getValue(component).toString()
            names.forEach { name -> assertFalse("\"$name\"" in json, "$component.$name") }
        }
    }

    private fun ByteArray.sha256(): String = MessageDigest.getInstance("SHA-256")
        .digest(this)
        .joinToString("") { byte -> "%02x".format(byte) }
}
