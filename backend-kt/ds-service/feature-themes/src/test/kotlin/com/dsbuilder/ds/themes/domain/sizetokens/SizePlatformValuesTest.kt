package com.dsbuilder.ds.themes.domain.sizetokens

import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Перевод px в формат платформ и чтение px из значения веба. */
class SizePlatformValuesTest {
    private val soft = listOf(ShadowLayer(0, 4, 14, -4, "#08080814"), ShadowLayer(0, 1, 4, -1, "#0000000A"))

    @Test
    fun `rem без лишних нулей`() {
        assertEquals("0.75rem", SizePlatformValues.rem(12))
        assertEquals("0rem", SizePlatformValues.rem(0))
        assertEquals("1.25rem", SizePlatformValues.rem(20))
        assertEquals("1rem", SizePlatformValues.rem(16))
        assertEquals("-0.25rem", SizePlatformValues.rem(-4))
        assertEquals("0.0625rem", SizePlatformValues.rem(1))
        assertEquals("62.5rem", SizePlatformValues.rem(1000))
    }

    @Test
    fun `радиус и отступ пишутся во все платформы`() {
        val radius = SizePlatformValues.write(SizeTokenKind.RADIUS, SizeTokenValue.Dimension(12))
        assertEquals(json("""["0.75rem"]"""), radius.value(ThemeTokenPlatform.WEB))
        assertEquals(json("""[{"kind":"round","cornerRadius":12}]"""), radius.value(ThemeTokenPlatform.ANDROID))
        assertEquals(json("""[{"kind":"round","cornerRadius":12}]"""), radius.value(ThemeTokenPlatform.IOS))
        assertTrue(radius.none(SizeWrittenValue::overridden))

        val spacing = SizePlatformValues.write(SizeTokenKind.SPACING, SizeTokenValue.Dimension(0))
        assertEquals(json("""["0rem"]"""), spacing.value(ThemeTokenPlatform.WEB))
        assertEquals(json("""[{"value":0}]"""), spacing.value(ThemeTokenPlatform.ANDROID))
        assertEquals(json("""[{"value":0}]"""), spacing.value(ThemeTokenPlatform.IOS))
    }

    @Test
    fun `своё значение платформы помечается признаком`() {
        val value = SizeTokenValue.Dimension(20, mapOf(NativePlatform.ANDROID to 18))
        val written = SizePlatformValues.write(SizeTokenKind.RADIUS, value).associateBy(SizeWrittenValue::platform)

        assertEquals(json("""["1.25rem"]"""), written.getValue(ThemeTokenPlatform.WEB).value)
        assertEquals(false, written.getValue(ThemeTokenPlatform.WEB).overridden)
        assertEquals(json("""[{"kind":"round","cornerRadius":20}]"""), written.getValue(ThemeTokenPlatform.IOS).value)
        assertEquals(false, written.getValue(ThemeTokenPlatform.IOS).overridden)
        assertEquals(
            json("""[{"kind":"round","cornerRadius":18}]"""),
            written.getValue(ThemeTokenPlatform.ANDROID).value,
        )
        assertEquals(true, written.getValue(ThemeTokenPlatform.ANDROID).overridden)
    }

    @Test
    fun `тень пишется CSS-строками на вебе и объектами на Android и iOS`() {
        val written = SizePlatformValues.write(SizeTokenKind.SHADOW, SizeTokenValue.Shadow(soft, 2))

        assertEquals(
            json("""["0rem 0.25rem 0.875rem -0.25rem #08080814","0rem 0.0625rem 0.25rem -0.0625rem #0000000A"]"""),
            written.value(ThemeTokenPlatform.WEB),
        )
        assertEquals(
            json(
                """[{"color":"#08080814","offsetX":0,"offsetY":4,"blurRadius":14,"spreadRadius":-4,""" +
                    """"fallbackElevation":2},{"color":"#0000000A","offsetX":0,"offsetY":1,"blurRadius":4,""" +
                    """"spreadRadius":-1,"fallbackElevation":0}]""",
            ),
            written.value(ThemeTokenPlatform.ANDROID),
        )
        assertEquals(
            json(
                """[{"color":"#08080814","offsetX":0,"offsetY":4,"blurRadius":14,"spreadRadius":-4},""" +
                    """{"color":"#0000000A","offsetX":0,"offsetY":1,"blurRadius":4,"spreadRadius":-1}]""",
            ),
            written.value(ThemeTokenPlatform.IOS),
        )
    }

    @Test
    fun `цвет слоя пишется как RRGGBBAA в верхнем регистре`() {
        val layer = ShadowLayer(1, 2, 3, 0, "#abcdef")
        val written = SizePlatformValues.write(SizeTokenKind.SHADOW, SizeTokenValue.Shadow(listOf(layer), 0))
        val web = written.value(ThemeTokenPlatform.WEB)
        assertEquals(json("""["0.0625rem 0.125rem 0.1875rem 0rem #ABCDEFFF"]"""), web)
        assertEquals("#08080814", SizePlatformValues.normalizedColor("#08080814"))
        assertEquals("#0000000A", SizePlatformValues.normalizedColor("#0000000a"))
    }

    @Test
    fun `ссылка цвета слоя пишется на месте цвета на всех платформах и читается обратно`() {
        val layer = ShadowLayer(0, 2, 8, 0, "[general.gray.900][0.16]")
        val written = SizePlatformValues.write(SizeTokenKind.SHADOW, SizeTokenValue.Shadow(listOf(layer), 4))
        val web = written.value(ThemeTokenPlatform.WEB)
        assertEquals(json("""["0rem 0.125rem 0.5rem 0rem [general.gray.900][0.16]"]"""), web)
        assertEquals(
            json(
                """[{"color":"[general.gray.900][0.16]","offsetX":0,"offsetY":2,"blurRadius":8,"spreadRadius":0,""" +
                    """"fallbackElevation":4}]""",
            ),
            written.value(ThemeTokenPlatform.ANDROID),
        )
        assertEquals(listOf(layer), SizePlatformValues.readShadow(ThemeTokenPlatform.WEB, web))
        assertEquals(
            listOf(layer),
            SizePlatformValues.readShadow(ThemeTokenPlatform.IOS, written.value(ThemeTokenPlatform.IOS)),
        )
        assertEquals("[general.gray.900]", SizePlatformValues.normalizedColor("[general.gray.900][1]"))
        assertEquals("[general.gray.900][0.5]", SizePlatformValues.normalizedColor(" [general.gray.900][0.50] "))
    }

    @Test
    fun `px читаются из значения веба`() {
        assertEquals(12, SizePlatformValues.readDimension(ThemeTokenPlatform.WEB, json("""["0.75rem"]""")))
        assertEquals(0, SizePlatformValues.readDimension(ThemeTokenPlatform.WEB, json("""["0rem"]""")))
        assertEquals(10000, SizePlatformValues.readDimension(ThemeTokenPlatform.WEB, json("""["625rem"]""")))
        assertEquals(8, SizePlatformValues.readDimension(ThemeTokenPlatform.WEB, json("""["8px"]""")))
        val android = json("""[{"cornerRadius":40}]""")
        assertEquals(40, SizePlatformValues.readDimension(ThemeTokenPlatform.ANDROID, android))
        assertEquals(8, SizePlatformValues.readDimension(ThemeTokenPlatform.IOS, json("""[{"value":8}]""")))
        assertNull(SizePlatformValues.readDimension(ThemeTokenPlatform.WEB, json("""["auto"]""")))
        assertNull(SizePlatformValues.readDimension(ThemeTokenPlatform.WEB, null))
    }

    @Test
    fun `слои тени читаются из CSS-строк веба и запасная высота из Android`() {
        val web = json(
            """["0rem 0.25rem 0.875rem -0.25rem #08080814","0rem 0.0625rem 0.25rem -0.0625rem #0000000A"]""",
        )
        assertEquals(soft, SizePlatformValues.readShadow(ThemeTokenPlatform.WEB, web))
        val android = SizePlatformValues.write(SizeTokenKind.SHADOW, SizeTokenValue.Shadow(soft, 4))
            .value(ThemeTokenPlatform.ANDROID)
        assertEquals(soft, SizePlatformValues.readShadow(ThemeTokenPlatform.ANDROID, android))
        assertEquals(4, SizePlatformValues.readFallbackElevation(android))
        assertEquals(0, SizePlatformValues.readFallbackElevation(json("""[{"color":"#000","offsetX":0}]""")))
        assertNull(SizePlatformValues.readShadow(ThemeTokenPlatform.WEB, json("""["0rem 1rem #000"]""")))
    }

    private fun List<SizeWrittenValue>.value(platform: ThemeTokenPlatform): JsonElement =
        single { it.platform == platform }.value

    private fun json(text: String): JsonElement = Json.parseToJsonElement(text)
}
