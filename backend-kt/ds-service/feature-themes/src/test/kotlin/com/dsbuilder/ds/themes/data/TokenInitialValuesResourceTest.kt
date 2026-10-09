package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.themes.domain.ThemePaletteType
import com.dsbuilder.ds.themes.domain.ThemeTokenMode
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.security.MessageDigest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class TokenInitialValuesResourceTest {
    @Test
    fun `canonical token values and palettes are complete and valid`() {
        val bytes = requireNotNull(javaClass.getResourceAsStream("/token-initial-values.json"))
            .use { it.readBytes() }
        val root = Json.parseToJsonElement(bytes.decodeToString()).jsonObject
        val values = root.getValue("values").jsonArray
        val palettes = root.getValue("palettes").jsonArray

        assertEquals("2583dedc8944f71079673e2579f0f139bba00e84820dd19fdaff695e12e73934", bytes.sha256())
        assertEquals(7_407, values.size)
        assertEquals(789, palettes.size)

        val paletteKeys = palettes.map { palette ->
            val value = palette.jsonObject
            val type = value.getValue("type").jsonPrimitive.content
            val shade = value.getValue("shade").jsonPrimitive.content
            val saturation = value.getValue("saturation").jsonPrimitive.int
            assertNotNull(ThemePaletteType.fromWire(type))
            assertTrue(shade.isNotBlank())
            assertTrue(value.getValue("value").jsonPrimitive.content.isNotBlank())
            PaletteKey(type, shade, saturation)
        }
        assertEquals(paletteKeys.size, paletteKeys.distinct().size)

        val valueKeys = values.map { definition ->
            val value = definition.jsonObject
            val name = value.getValue("name").jsonPrimitive.content
            val platform = value.getValue("platform").jsonPrimitive.content
            val mode = value["mode"]?.jsonPrimitive?.content?.takeUnless { it == "null" }
            assertTrue(name.isNotBlank())
            assertNotNull(ThemeTokenType.fromWire(value.getValue("type").jsonPrimitive.content))
            assertNotNull(ThemeTokenPlatform.fromWire(platform))
            mode?.let { assertNotNull(ThemeTokenMode.fromWire(it)) }
            (value["palette"] as? JsonObject)?.let { palette ->
                assertTrue(
                    PaletteKey(
                        palette.getValue("type").jsonPrimitive.content,
                        palette.getValue("shade").jsonPrimitive.content,
                        palette.getValue("saturation").jsonPrimitive.int,
                    ) in paletteKeys,
                )
            }
            ValueKey(name, platform, mode)
        }
        assertEquals(valueKeys.size, valueKeys.distinct().size)
    }

    private data class PaletteKey(val type: String, val shade: String, val saturation: Int)
    private data class ValueKey(val name: String, val platform: String, val mode: String?)

    private fun ByteArray.sha256(): String = MessageDigest.getInstance("SHA-256")
        .digest(this)
        .joinToString("") { byte -> "%02x".format(byte) }
}
