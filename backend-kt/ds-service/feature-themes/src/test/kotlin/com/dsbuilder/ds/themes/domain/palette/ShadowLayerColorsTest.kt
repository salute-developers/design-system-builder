package com.dsbuilder.ds.themes.domain.palette

import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals

/** Ссылки цветов слоёв тени: поиск и замена на своём месте в CSS-строках веба и объектах платформ. */
class ShadowLayerColorsTest {
    private val gray = PaletteReference.parse("[general.gray.900][0.16]")!!

    @Test
    fun `ссылки ищутся в CSS-строках веба и в полях color платформ`() {
        val web = Json.parseToJsonElement(
            """["0rem 0.25rem 0.875rem -0.25rem [general.gray.900][0.16]","0rem 0.0625rem 0.25rem 0rem #0000000A"]""",
        )
        val ios = Json.parseToJsonElement("""[{"color":"[general.gray.900][0.16]","offsetX":0},{"color":"#000"}]""")

        assertEquals(listOf(gray), ShadowLayerColors.references(web))
        assertEquals(listOf(gray), ShadowLayerColors.references(ios))
        assertEquals(emptyList(), ShadowLayerColors.references(Json.parseToJsonElement("""["#FFFFFF"]""")))
        assertEquals(emptyList(), ShadowLayerColors.references(null))
    }

    @Test
    fun `замена меняет только цвет слоя со ссылкой`() {
        val web = Json.parseToJsonElement(
            """["0rem 0.25rem 0.875rem -0.25rem [general.gray.900][0.16]","1rem 1rem 1rem 1rem #FFFFFFFF"]""",
        )
        val android = Json.parseToJsonElement(
            """[{"color":"[general.gray.900][0.16]","offsetX":1,"fallbackElevation":2}]""",
        )

        assertEquals(
            Json.parseToJsonElement("""["0rem 0.25rem 0.875rem -0.25rem #10101029","1rem 1rem 1rem 1rem #FFFFFFFF"]"""),
            ShadowLayerColors.mapReferences(web) { "#10101029" },
        )
        assertEquals(
            Json.parseToJsonElement("""[{"color":"[general.coolGray.900][0.16]","offsetX":1,"fallbackElevation":2}]"""),
            ShadowLayerColors.mapReferences(
                android,
            ) { it.copy(ramp = PaletteRampRef.parse("general.coolGray")!!).format() },
        )
        assertEquals(web, ShadowLayerColors.mapReferences(web) { null })
    }
}
