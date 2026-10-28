package com.dsbuilder.ds.themes.domain.colortokens

import com.dsbuilder.ds.themes.domain.ThemePaletteType
import com.dsbuilder.ds.themes.domain.palette.PaletteRampRef
import com.dsbuilder.ds.themes.domain.palette.PaletteReference
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class WebGradientGrammarTest {
    private val green = PaletteRampRef(ThemePaletteType.GENERAL, "green")

    @Test
    fun `linear radial and conic forms of the editor are parsed`() {
        assertEquals(
            WebGradientLayer.Linear(
                45.0,
                listOf(GradientStop(StopColor.Hex("#1A9E32FF"), 0.0), GradientStop(StopColor.Hex("#04C6C9FF"), 99.688)),
            ),
            WebGradientGrammar.parse("linear-gradient(45.00deg, #1A9E32FF 0%, #04C6C9FF 99.688%)"),
        )
        assertEquals(
            WebGradientLayer.Radial(
                50.0,
                25.0,
                75.0,
                listOf(GradientStop(StopColor.Hex("#FFFFFF"), 0.0), GradientStop(StopColor.Hex("#000000"), 100.0)),
            ),
            WebGradientGrammar.parse("radial-gradient(50% 50% at 25% 75%, #FFFFFF 0%, #000000 100%)"),
        )
        val conic = WebGradientGrammar.parse(
            "conic-gradient(from 90deg at 50% 50%, [general.green.500][0.8] 0%, #04C6C9FF 100%)",
        )
        assertEquals(
            WebGradientLayer.Conic(
                90.0,
                50.0,
                50.0,
                listOf(
                    GradientStop(StopColor.Ref(PaletteReference(green, 500, 0.8)), 0.0),
                    GradientStop(StopColor.Hex("#04C6C9FF"), 100.0),
                ),
            ),
            conic,
        )
        val equalPositions = WebGradientGrammar.parse("linear-gradient(-10deg,#FFF000 0%,#FFF000 0%,#000000 100%)")
        assertEquals(-10.0, (equalPositions as WebGradientLayer.Linear).angle)
        assertEquals(3, equalPositions.stops.size)
    }

    @Test
    fun `forms outside the editor grammar are rejected`() {
        listOf(
            "linear-gradient(90deg, #FFFFFF 0%)",
            "linear-gradient(90deg, #FFFFFF 60%, #000000 40%)",
            "linear-gradient(90deg, #FFFFFF 0%, #000000 120%)",
            "linear-gradient(to right, #FFFFFF 0%, #000000 100%)",
            "linear-gradient(90deg, #FFF 0%, #000000 100%)",
            "linear-gradient(90deg, red 0%, #000000 100%)",
            "linear-gradient(90deg, #FFFFFF, #000000)",
            "radial-gradient(circle at 50% 50%, #FFFFFF 0%, #000000 100%)",
            "radial-gradient(50% 40% at 50% 50%, #FFFFFF 0%, #000000 100%)",
            "radial-gradient(50% 50% at 150% 50%, #FFFFFF 0%, #000000 100%)",
            "conic-gradient(90deg at 50% 50%, #FFFFFF 0%, #000000 100%)",
            "conic-gradient(from 90deg, #FFFFFF 0%, #000000 100%)",
            "linear-gradient(90deg, [general.green.500][1.5] 0%, #000000 100%)",
            "repeating-linear-gradient(90deg, #FFFFFF 0%, #000000 100%)",
            "#FFFFFF",
        ).forEach { assertNull(WebGradientGrammar.parse(it), it) }
        assertTrue(WebGradientGrammar.isFunction("linear-gradient(to right, #FFFFFF 0%, #000000 100%)"))
    }
}
