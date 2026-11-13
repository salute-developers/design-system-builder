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
        val bytes = requireNotNull(javaClass.getResourceAsStream("/dsbuilder/ds/seeds/component-seeds.json")).use {
            it.readBytes()
        }
        val root = Json.parseToJsonElement(bytes.decodeToString()).jsonObject
        val components = root.getValue("components").jsonArray

        assertEquals("857c316cb6e2b6f894f7680694c5660f3d32b376b2c4098eacbc4103b821bdfb", bytes.sha256())
        assertEquals(90, components.size)
        assertEquals(38, root.getValue("dependencies").jsonArray.size)
        assertEquals(104, components.sumOf { it.jsonObject.getValue("appearances").jsonArray.size })
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
        val text = requireNotNull(javaClass.getResourceAsStream("/dsbuilder/ds/seeds/component-seeds.json")).use {
            it.readBytes()
        }
            .decodeToString()
        val list = Json.parseToJsonElement(text).jsonObject.getValue("components").jsonArray
            .single { it.jsonObject.getValue("name").jsonPrimitive.content == "List" }.jsonObject
        val bound = list.getValue("propertyVariations").jsonArray
            .map { it.jsonObject.getValue("property").jsonPrimitive.content }

        assertTrue("listItemDividerHeight" in bound)
        assertFalse("listItemDividerWidth" in text)
    }

    @Test
    fun `skeleton paints the shimmer gradient`() {
        val text = requireNotNull(javaClass.getResourceAsStream("/dsbuilder/ds/seeds/component-seeds.json")).use {
            it.readBytes()
        }
            .decodeToString()
        val skeleton = Json.parseToJsonElement(text).jsonObject.getValue("components").jsonArray
            .single { it.jsonObject.getValue("name").jsonPrimitive.content == "Skeleton" }.jsonObject
        val bindings = skeleton.getValue("propertyVariations").jsonArray.map { binding ->
            val value = binding.jsonObject
            value.getValue("property").jsonPrimitive.content to value.getValue("variation").jsonPrimitive.content
        }
        val view = skeleton.getValue("appearances").jsonArray.single().jsonObject
            .getValue("values").jsonObject.getValue("view").jsonObject
        fun tokens(style: String) = view.getValue(style).jsonArray
            .map { it.jsonObject }
            .filter { "state" !in it && "token" in it }
            .associate { it.getValue("prop").jsonPrimitive.content to it.getValue("token").jsonPrimitive.content }
        val fades = mapOf(
            "fadeInColor" to "surface.default.transparent-secondary",
            "fadeOutColor" to "surface.default.transparent-tertiary",
        )

        assertTrue("gradientColor" to "view" in bindings)
        assertEquals(fades + ("gradientColor" to "surface.default.skeleton-gradient"), tokens("default"))
        assertEquals(fades + ("gradientColor" to "surface.default.skeleton-deep-gradient"), tokens("lighter"))
    }

    @Test
    fun `properties without a web parameter are not referenced`() {
        val text = requireNotNull(javaClass.getResourceAsStream("/dsbuilder/ds/seeds/component-seeds.json")).use {
            it.readBytes()
        }
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
