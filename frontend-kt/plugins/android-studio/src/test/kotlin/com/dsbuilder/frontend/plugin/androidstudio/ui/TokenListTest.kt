package com.dsbuilder.frontend.plugin.androidstudio.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.dsbuilder.frontend.plugin.androidstudio.tokens.GradientLayer
import com.dsbuilder.frontend.plugin.androidstudio.tokens.ShadowLayerValue
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenValuePayload
import com.sdds.compose.uikit.graphics.Gradients
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

class GradientBrushTest {
    @Test
    fun buildsLinearGradientBrush() {
        val layer = GradientLayer.Linear(listOf("#1A9E32FF", "#04C6C9FF"), listOf(0f, 1f), 45f)

        assertEquals(
            Gradients.Linear(
                listOf(parseHexColor("#1A9E32FF")!!, parseHexColor("#04C6C9FF")!!),
                listOf(0f, 1f),
                45f,
            ),
            gradientBrush(layer),
        )
    }

    @Test
    fun buildsRadialGradientBrush() {
        val layer = GradientLayer.Radial(
            listOf("#FFFFFF", "#000000"),
            listOf(0f, 1f),
            radius = 10f,
            centerX = 0.5f,
            centerY = 0.5f,
        )

        assertEquals(
            Gradients.Radial(
                listOf(parseHexColor("#FFFFFF")!!, parseHexColor("#000000")!!),
                listOf(0f, 1f),
                10f,
                0.5f,
                0.5f,
            ),
            gradientBrush(layer),
        )
    }

    @Test
    fun buildsSweepGradientBrushForAngularKind() {
        val layer = GradientLayer.Angular(listOf("#FFFFFF", "#000000"), listOf(0f, 1f), centerX = 0.5f, centerY = 0.5f)

        assertEquals(
            Gradients.Sweep(listOf(parseHexColor("#FFFFFF")!!, parseHexColor("#000000")!!), listOf(0f, 1f), 0.5f, 0.5f),
            gradientBrush(layer),
        )
    }

    @Test
    fun buildsSolidColorBrushForColorKind() {
        assertEquals(SolidColor(parseHexColor("#FFFFFF")!!), gradientBrush(GradientLayer.Solid("#FFFFFF")))
    }
}

class TypographyTextStyleTest {
    @Test
    fun mapsFieldsDirectly() {
        val value = TokenValuePayload.TypographyValue(
            fontFamilyRef = "fontFamily.body",
            fontSizeSp = 18f,
            lineHeightSp = 22f,
            fontWeight = 600,
            fontStyle = "normal",
            letterSpacingEm = -0.02f,
        )

        val style = typographyTextStyle(value)

        assertEquals(18f.sp, style.fontSize)
        assertEquals(22f.sp, style.lineHeight)
        assertEquals(FontWeight(600), style.fontWeight)
        assertEquals((-0.02f).em, style.letterSpacing)
    }
}

class SpacingPreviewWidthTest {
    @Test
    fun passesSmallValuesThrough() {
        assertEquals(8f, spacingPreviewWidthDp(8f))
    }

    @Test
    fun clampsLargeValuesToMax() {
        assertEquals(64f, spacingPreviewWidthDp(80f))
    }
}

class DescribeValueTest {
    @Test
    fun describesShapeAndSpacingAsDp() {
        assertEquals("12dp", describeValue(TokenValuePayload.ShapeValue(12f), null))
        assertEquals("8dp", describeValue(TokenValuePayload.SpacingValue(8f), null))
    }

    @Test
    fun describesSentinelShapeRadiusAsCircleInsteadOfDp() {
        // round.circle использует заведомо нереальный радиус (9999dp в сидах) как сигнал
        // «максимально круглая форма», а не как измерение — не должен показываться как dp.
        assertEquals("circle", describeValue(TokenValuePayload.ShapeValue(9999f), null))
        assertEquals("32dp", describeValue(TokenValuePayload.ShapeValue(32f), null))
    }

    @Test
    fun describesLinearGradientWithAngle() {
        val gradient = TokenValuePayload.GradientValue(listOf(GradientLayer.Linear(listOf("#FFFFFF"), listOf(0f), 45f)))

        assertEquals("linear, 45°", describeValue(gradient, null))
    }

    @Test
    fun describesShadowWithFirstLayerAndExtraCount() {
        val shadow = TokenValuePayload.ShadowValue(
            listOf(
                ShadowLayerValue("#000000", 0f, 4f, -4f, 14f, 2f),
                ShadowLayerValue("#000000", 0f, 1f, -1f, 4f, 0f),
            ),
        )

        assertEquals("blur 14dp, offset 4dp +1", describeValue(shadow, null))
    }

    @Test
    fun unsupportedFallsBackToRawValue() {
        assertEquals("some-raw-text", describeValue(TokenValuePayload.Unsupported, "some-raw-text"))
        assertEquals("—", describeValue(TokenValuePayload.Unsupported, null))
    }
}
