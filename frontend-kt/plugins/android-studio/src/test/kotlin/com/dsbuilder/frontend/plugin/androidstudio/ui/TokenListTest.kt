package com.dsbuilder.frontend.plugin.androidstudio.ui

import androidx.compose.ui.graphics.Color
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ParseHexColorTest {
    @Test
    fun parsesSixDigitHex() {
        assertEquals(Color(red = 0xFF, green = 0x00, blue = 0x00), parseHexColor("#FF0000"))
    }

    @Test
    fun parsesEightDigitHexAsAlphaRgb() {
        // Реальные значения из backend'а приходят в этой форме (после unwrap из ["#F5F5F5F5"]).
        assertEquals(
            Color(alpha = 0xF5, red = 0xF5, green = 0xF5, blue = 0xF5),
            parseHexColor("#F5F5F5F5"),
        )
    }

    @Test
    fun returnsNullForNonColorValue() {
        assertNull(parseHexColor("16"))
        assertNull(parseHexColor(null))
        assertNull(parseHexColor("[\"a\",\"b\"]"))
    }
}
