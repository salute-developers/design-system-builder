package com.dsbuilder.frontend.plugin.androidstudio.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.dsbuilder.frontend.plugin.androidstudio.tokens.GradientLayer
import com.dsbuilder.frontend.plugin.androidstudio.tokens.ShadowLayerValue
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenType
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenValuePayload
import com.sdds.compose.uikit.graphics.Gradients
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ParseHexColorTest {
    @Test
    fun parsesSixDigitHex() {
        assertEquals(Color(red = 0xFF, green = 0x00, blue = 0x00), parseHexColor("#FF0000"))
    }

    @Test
    fun parsesEightDigitHexAsRgbAlpha() {
        // Тема хранит цвета как #RRGGBBAA (прозрачность в конце): #14B32EFF — непрозрачный зелёный.
        assertEquals(
            Color(red = 0x14, green = 0xB3, blue = 0x2E, alpha = 0xFF),
            parseHexColor("#14B32EFF"),
        )
        assertEquals(
            Color(red = 0x17, green = 0x17, blue = 0x17, alpha = 0xF5),
            parseHexColor("#171717F5"),
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

class TokenListFormattingTest {
    @Test
    fun tabsFollowFixedOrderRegardlessOfInputOrder() {
        val shuffled = listOf(
            TokenType.SPACING,
            null,
            TokenType.SHAPE,
            TokenType.COLOR,
            TokenType.SHADOW,
            TokenType.TYPOGRAPHY,
            TokenType.GRADIENT,
            TokenType.COLOR,
        )

        assertEquals(
            listOf(
                TokenType.COLOR,
                TokenType.GRADIENT,
                TokenType.TYPOGRAPHY,
                TokenType.SHADOW,
                TokenType.SHAPE,
                TokenType.SPACING,
                null,
            ),
            orderedTokenTypes(shuffled),
        )
    }

    @Test
    fun formatsHexAsAndroidAarrggbb() {
        assertEquals("#FF108E26", formatHexAarrggbb("#108E26"))
        assertEquals("#FF14B32E", formatHexAarrggbb("#14b32eff"))
        assertEquals("#8F28D247", formatHexAarrggbb("28D2478F"))
        assertEquals("#F5171717", formatHexAarrggbb("#171717F5"))
        assertEquals("not-a-color", formatHexAarrggbb("not-a-color"))
    }

    @Test
    fun themeDependsOnlyForColorAndGradient() {
        assertTrue(TokenType.COLOR.isThemeDependent())
        assertTrue(TokenType.GRADIENT.isThemeDependent())
        listOf(TokenType.TYPOGRAPHY, TokenType.SPACING, TokenType.SHAPE, TokenType.SHADOW, null).forEach {
            assertFalse(it.isThemeDependent(), "$it")
        }
    }
}
