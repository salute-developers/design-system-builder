package com.dsbuilder.frontend.plugin.androidstudio.tokens

import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

private fun json(text: String) = Json.parseToJsonElement(text)

class TokenValueParserTest {

    @Test
    fun parsesColorOnAnyPlatform() {
        val payload = parseTokenValuePayload(TokenType.COLOR, TokenPlatform.WEB, json("""["#F5F5F5F5"]"""))

        assertEquals(TokenValuePayload.ColorValue("#F5F5F5F5"), payload)
    }

    @Test
    fun parsesAndroidShape() {
        val payload = parseTokenValuePayload(
            TokenType.SHAPE,
            TokenPlatform.ANDROID,
            json("""[{"kind":"round","cornerRadius":12}]"""),
        )

        assertEquals(TokenValuePayload.ShapeValue(12f), payload)
    }

    @Test
    fun unknownShapeKindIsUnsupported() {
        val payload = parseTokenValuePayload(
            TokenType.SHAPE,
            TokenPlatform.ANDROID,
            json("""[{"kind":"squircle","cornerRadius":12}]"""),
        )

        assertEquals(TokenValuePayload.Unsupported, payload)
    }

    @Test
    fun webShapeIsUnsupported() {
        // web-значение — CSS-строка ("0.75rem"), а не объект; рендерится как rawValue-текст.
        val payload = parseTokenValuePayload(TokenType.SHAPE, TokenPlatform.WEB, json(""""0.75rem""""))

        assertEquals(TokenValuePayload.Unsupported, payload)
    }

    @Test
    fun parsesIosSpacing() {
        val payload = parseTokenValuePayload(TokenType.SPACING, TokenPlatform.IOS, json("""[{"value":8}]"""))

        assertEquals(TokenValuePayload.SpacingValue(8f), payload)
    }

    @Test
    fun parsesLinearGradient() {
        val payload = parseTokenValuePayload(
            TokenType.GRADIENT,
            TokenPlatform.ANDROID,
            json("""[{"kind":"linear","locations":[0,1],"colors":["#1A9E32FF","#04C6C9FF"],"angle":45}]"""),
        )

        val gradient = assertIs<TokenValuePayload.GradientValue>(payload)
        assertEquals(
            listOf(GradientLayer.Linear(listOf("#1A9E32FF", "#04C6C9FF"), listOf(0f, 1f), 45f)),
            gradient.layers,
        )
    }

    @Test
    fun parsesAndroidRadialGradientRadiusDirectly() {
        val payload = parseTokenValuePayload(
            TokenType.GRADIENT,
            TokenPlatform.ANDROID,
            json(
                """[{"kind":"radial","locations":[0,1],"colors":["#FFF","#000"],"centerX":0.5,"centerY":0.5,
                    "radius":10}]""",
            ),
        )

        val gradient = assertIs<TokenValuePayload.GradientValue>(payload)
        assertEquals(
            GradientLayer.Radial(listOf("#FFF", "#000"), listOf(0f, 1f), radius = 10f, centerX = 0.5f, centerY = 0.5f),
            gradient.layers.single(),
        )
    }

    @Test
    fun parsesIosRadialGradientFallingBackToEndRadius() {
        // ios не даёт `radius` напрямую — только `startRadius`/`endRadius`; берём `endRadius`.
        val payload = parseTokenValuePayload(
            TokenType.GRADIENT,
            TokenPlatform.IOS,
            json(
                """[{"kind":"radial","locations":[0,1],"colors":["#FFF","#000"],"centerX":0.5,"centerY":0.5,
                    "startRadius":0,"endRadius":10}]""",
            ),
        )

        val gradient = assertIs<TokenValuePayload.GradientValue>(payload)
        assertEquals(
            GradientLayer.Radial(listOf("#FFF", "#000"), listOf(0f, 1f), radius = 10f, centerX = 0.5f, centerY = 0.5f),
            gradient.layers.single(),
        )
    }

    @Test
    fun parsesAngularGradient() {
        val payload = parseTokenValuePayload(
            TokenType.GRADIENT,
            TokenPlatform.ANDROID,
            json("""[{"kind":"angular","locations":[0,1],"colors":["#FFF","#000"],"centerX":0.5,"centerY":0.5}]"""),
        )

        val gradient = assertIs<TokenValuePayload.GradientValue>(payload)
        assertEquals(
            GradientLayer.Angular(listOf("#FFF", "#000"), listOf(0f, 1f), centerX = 0.5f, centerY = 0.5f),
            gradient.layers.single(),
        )
    }

    @Test
    fun parsesSolidColorGradient() {
        val payload = parseTokenValuePayload(
            TokenType.GRADIENT,
            TokenPlatform.IOS,
            json("""[{"kind":"color","background":"#FFFFFF"}]"""),
        )

        val gradient = assertIs<TokenValuePayload.GradientValue>(payload)
        assertEquals(GradientLayer.Solid("#FFFFFF"), gradient.layers.single())
    }

    @Test
    fun webGradientIsUnsupported() {
        val payload = parseTokenValuePayload(
            TokenType.GRADIENT,
            TokenPlatform.WEB,
            json("""["linear-gradient(45.00deg, #1A9E32FF 0%, #04C6C9FF 99.688%)"]"""),
        )

        assertEquals(TokenValuePayload.Unsupported, payload)
    }

    @Test
    fun parsesMultiLayerShadow() {
        val payload = parseTokenValuePayload(
            TokenType.SHADOW,
            TokenPlatform.ANDROID,
            json(
                """[
                    {"color":"#08080814","offsetX":0,"offsetY":4,"spreadRadius":-4,"blurRadius":14,
                        "fallbackElevation":2},
                    {"color":"#0000000A","offsetX":0,"offsetY":1,"spreadRadius":-1,"blurRadius":4,
                        "fallbackElevation":0}
                ]""",
            ),
        )

        val shadow = assertIs<TokenValuePayload.ShadowValue>(payload)
        assertEquals(
            listOf(
                ShadowLayerValue("#08080814", 0f, 4f, -4f, 14f, 2f),
                ShadowLayerValue("#0000000A", 0f, 1f, -1f, 4f, 0f),
            ),
            shadow.layers,
        )
    }

    @Test
    fun shadowWithoutFallbackElevationIsStillParsed() {
        val payload = parseTokenValuePayload(
            TokenType.SHADOW,
            TokenPlatform.IOS,
            json("""[{"color":"#000","offsetX":0,"offsetY":24,"spreadRadius":-8,"blurRadius":48}]"""),
        )

        val shadow = assertIs<TokenValuePayload.ShadowValue>(payload)
        assertEquals(ShadowLayerValue("#000", 0f, 24f, -8f, 48f, null), shadow.layers.single())
    }

    @Test
    fun parsesAndroidTypographyWithNumericWeight() {
        val payload = parseTokenValuePayload(
            TokenType.TYPOGRAPHY,
            TokenPlatform.ANDROID,
            json(
                """[{"fontFamilyRef":"fontFamily.body","fontWeight":600,"fontStyle":"normal","textSize":18,
                    "lineHeight":22,"letterSpacing":-0.02}]""",
            ),
        )

        assertEquals(
            TokenValuePayload.TypographyValue("fontFamily.body", 18f, 22f, 600, "normal", -0.02f),
            payload,
        )
    }

    @Test
    fun parsesIosTypographyMappingWeightEnumToNumber() {
        val payload = parseTokenValuePayload(
            TokenType.TYPOGRAPHY,
            TokenPlatform.IOS,
            json(
                """[{"fontFamilyRef":"fontFamily.body","weight":"semibold","style":"normal","size":18,
                    "lineHeight":22,"kerning":-0.02}]""",
            ),
        )

        assertEquals(
            TokenValuePayload.TypographyValue("fontFamily.body", 18f, 22f, 600, "normal", -0.02f),
            payload,
        )
    }

    @Test
    fun unknownIosWeightFallsBackToNormalInsteadOfUnsupported() {
        val payload = parseTokenValuePayload(
            TokenType.TYPOGRAPHY,
            TokenPlatform.IOS,
            json(
                """[{"fontFamilyRef":"fontFamily.body","weight":"extra-bold-condensed","style":"normal","size":18,
                    "lineHeight":22,"kerning":0}]""",
            ),
        )

        val typography = assertIs<TokenValuePayload.TypographyValue>(payload)
        assertEquals(400, typography.fontWeight)
    }

    @Test
    fun missingValueIsUnsupported() {
        val payload = parseTokenValuePayload(TokenType.SHAPE, TokenPlatform.ANDROID, null)

        assertEquals(TokenValuePayload.Unsupported, payload)
    }
}
