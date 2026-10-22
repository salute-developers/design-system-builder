package com.dsbuilder.ds.themes.domain.colortokens

import com.dsbuilder.ds.themes.domain.ThemePaletteType
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.palette.PaletteRampRef
import com.dsbuilder.ds.themes.domain.palette.PaletteReference
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class ColorValueShapeTest {
    private val green = PaletteRampRef(ThemePaletteType.GENERAL, "green")

    @Test
    fun `value kind follows the platform format`() {
        assertEquals(ColorValueKind.COLOR, kind(ThemeTokenPlatform.WEB, """["#FFFFFF"]"""))
        assertEquals(ColorValueKind.COLOR, kind(ThemeTokenPlatform.WEB, "\"[general.green.500]\""))
        assertEquals(
            ColorValueKind.GRADIENT,
            kind(ThemeTokenPlatform.WEB, """["linear-gradient(90deg, #FFFFFF 0%, #000000 100%)", "#FFFFFF"]"""),
        )
        assertNull(kind(ThemeTokenPlatform.WEB, """["#FFFFFF", "#000000"]"""))
        assertNull(kind(ThemeTokenPlatform.WEB, """[{"kind":"color","background":"#FFFFFF"}]"""))
        assertEquals(ColorValueKind.COLOR, kind(ThemeTokenPlatform.IOS, """[{"kind":"color","background":"#FFF"}]"""))
        assertEquals(ColorValueKind.GRADIENT, kind(ThemeTokenPlatform.IOS, IOS_LAYERS))
        assertEquals(ColorValueKind.GRADIENT, kind(ThemeTokenPlatform.ANDROID, ANDROID_LAYERS))
        assertNull(
            kind(
                ThemeTokenPlatform.IOS,
                """[{"kind":"color","background":"#FFF"},{"kind":"color","background":"#000"}]""",
            ),
        )
    }

    @Test
    fun `native layers are checked by the format of their platform`() {
        assertNull(ColorValueShape.nativeLayerViolation(ThemeTokenPlatform.IOS, json(IOS_LAYERS)))
        assertNull(ColorValueShape.nativeLayerViolation(ThemeTokenPlatform.ANDROID, json(ANDROID_LAYERS)))
        // Слой iOS с startRadius/endRadius и angular с углами не являются слоями Android.
        assertNotNull(ColorValueShape.nativeLayerViolation(ThemeTokenPlatform.ANDROID, json(IOS_LAYERS)))
        listOf(
            """[{"locations":[0,1],"colors":["#FFF","#000"],"angle":90}]""",
            """[{"kind":"linear","locations":[0],"colors":["#FFF"],"angle":90}]""",
            """[{"kind":"linear","locations":[0,1],"colors":["#FFF"],"angle":90}]""",
            """[{"kind":"linear","locations":[1,0],"colors":["#FFF","#000"],"angle":90}]""",
            """[{"kind":"linear","locations":[0,2],"colors":["#FFF","#000"],"angle":90}]""",
            """[{"kind":"linear","locations":[0,1],"colors":["red","#000"],"angle":90}]""",
            """[{"kind":"linear","locations":[0,1],"colors":["#FFF","#000"]}]""",
            """[{"kind":"radial","locations":[0,1],"colors":["#FFF","#000"],"centerX":2,"centerY":0.5,"radius":1}]""",
            """[{"kind":"radial","locations":[0,1],"colors":["#FFF","#000"],"centerX":0,"centerY":0.5,"radius":-1}]""",
            """[{"kind":"diamond","locations":[0,1],"colors":["#FFF","#000"]}]""",
            """[]""",
            """["#FFFFFF"]""",
        ).forEach { assertNotNull(ColorValueShape.nativeLayerViolation(ThemeTokenPlatform.ANDROID, json(it)), it) }
    }

    @Test
    fun `solid platform values are stored as a string and published as a color layer for gradients`() {
        val layer = json("""[{"kind":"color","background":"#1A9E32FF"}]""")
        assertEquals(json("""["#1A9E32FF"]"""), ColorValueShape.storedForm(ThemeTokenPlatform.IOS, layer))
        assertEquals(layer, ColorValueShape.storedForm(ThemeTokenPlatform.WEB, layer))
        assertEquals(json(IOS_LAYERS), ColorValueShape.storedForm(ThemeTokenPlatform.IOS, json(IOS_LAYERS)))
        val stored = json("""["#1A9E32FF"]""")
        assertEquals(layer, ColorValueShape.publishedForm(ThemeTokenPlatform.ANDROID, stored, ThemeTokenType.GRADIENT))
        assertEquals(stored, ColorValueShape.publishedForm(ThemeTokenPlatform.ANDROID, stored, ThemeTokenType.COLOR))
        assertEquals(stored, ColorValueShape.publishedForm(ThemeTokenPlatform.WEB, stored, ThemeTokenType.GRADIENT))
    }

    @Test
    fun `family type is gradient while any value is a gradient`() {
        val solid = FamilyValue(ThemeTokenPlatform.WEB, json("""["#FFFFFF"]"""))
        val paletteId = FamilyValue(ThemeTokenPlatform.IOS, null)
        val gradient = FamilyValue(ThemeTokenPlatform.ANDROID, json(ANDROID_LAYERS))
        assertEquals(ThemeTokenType.COLOR, ColorTokenFamilyType.of(listOf(solid, paletteId)))
        assertEquals(ThemeTokenType.GRADIENT, ColorTokenFamilyType.of(listOf(solid, paletteId, gradient)))
        assertEquals(ThemeTokenType.COLOR, ColorTokenFamilyType.of(emptyList()))
    }

    @Test
    fun `palette references are found and rewritten inside gradients`() {
        val web = json("""["linear-gradient(90deg, [general.amber.300][0.56] 0%, #FFFFFFFF 100%)"]""")
        val android = json(
            """[{"kind":"linear","locations":[0,1],"colors":["[general.green.500]","#FFFFFFFF"],"angle":90}]""",
        )
        val amber = PaletteReference(PaletteRampRef(ThemePaletteType.GENERAL, "amber"), 300, 0.56)
        assertEquals(listOf(amber), ValuePaletteReferences.find(web))
        assertEquals(listOf(PaletteReference(green, 500, null)), ValuePaletteReferences.find(android))
        assertEquals(
            listOf(PaletteReference(green, 500, null)),
            ValuePaletteReferences.find(json("\"[general.green.500]\"")),
        )
        assertEquals(
            json("""["linear-gradient(90deg, [additional.h190.300][0.56] 0%, #FFFFFFFF 100%)"]"""),
            ValuePaletteReferences.rewrite(
                web,
            ) { it.copy(ramp = PaletteRampRef(ThemePaletteType.ADDITIONAL, "h190")).format() },
        )
        assertEquals(
            json("""[{"kind":"linear","locations":[0,1],"colors":["#00FF00","#FFFFFFFF"],"angle":90}]"""),
            ValuePaletteReferences.rewrite(android) { if (it.ramp == green) "#00FF00" else null },
        )
        assertEquals(web, ValuePaletteReferences.rewrite(web) { null })
    }

    private fun kind(platform: ThemeTokenPlatform, value: String) = ColorValueShape.kind(platform, json(value))

    private fun json(value: String): JsonElement = Json.parseToJsonElement(value)

    private companion object {
        const val IOS_LAYERS = """[{"kind":"radial","locations":[0,1],"colors":["#FFF","#000"],""" +
            """"centerX":0.5,"centerY":0.5,"startRadius":0,"endRadius":1},""" +
            """{"kind":"angular","locations":[0,0.5,1],"colors":["#FFF","#000","#FFF"],""" +
            """"startAngle":0,"endAngle":360,"centerX":0.5,"centerY":0.5},{"kind":"color","background":"#FFF"}]"""
        const val ANDROID_LAYERS = """[{"kind":"radial","locations":[0,1],"colors":["#FFF","#000"],""" +
            """"centerX":0.5,"centerY":0.5,"radius":1},""" +
            """{"kind":"angular","locations":[0,1],"colors":["#FFF","#000"],"centerX":0.5,"centerY":0.5}]"""
    }
}
