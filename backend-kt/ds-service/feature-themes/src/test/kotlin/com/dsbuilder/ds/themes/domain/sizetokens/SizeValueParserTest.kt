package com.dsbuilder.ds.themes.domain.sizetokens

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

/** Проверка значений: тексты и диапазоны таблицы проверок, поле запроса и вид тела. */
class SizeValueParserTest {
    private val radius = SizeTokenKind.RADIUS
    private val spacing = SizeTokenKind.SPACING
    private val shadow = SizeTokenKind.SHADOW

    @Test
    fun `радиус и отступ — целое число в своём диапазоне`() {
        assertEquals(SizeTokenValue.Dimension(12), valid(radius, """{"valuePx":12}"""))
        assertEquals(SizeTokenValue.Dimension(0), valid(spacing, """{"valuePx":0}"""))
        assertEquals(SizeTokenValue.Dimension(1000), valid(radius, """{"valuePx":1000}"""))
        assertEquals(violation("valuePx", SizeValueParser.NOT_INTEGER), invalid(radius, """{"valuePx":12.5}"""))
        assertEquals(
            violation("valuePx", "Значение должно быть в диапазоне 0–1000 px."),
            invalid(radius, """{"valuePx":1200}"""),
        )
        assertEquals(
            violation("valuePx", "Значение должно быть в диапазоне 0–128 px."),
            invalid(spacing, """{"valuePx":140}"""),
        )
        assertEquals(
            violation("valuePx", "Значение должно быть в диапазоне 0–128 px."),
            invalid(spacing, """{"valuePx":-1}"""),
        )
        assertEquals(violation("valuePx", SizeValueParser.EMPTY), invalid(radius, """{}"""))
        assertEquals(violation("valuePx", SizeValueParser.EMPTY), invalid(radius, """{"valuePx":""}"""))
        assertEquals(violation("valuePx", SizeValueParser.NOT_NUMBER), invalid(radius, """{"valuePx":"abc"}"""))
        assertEquals(violation("valuePx", SizeValueParser.NOT_NUMBER), invalid(radius, """{"valuePx":true}"""))
    }

    @Test
    fun `свои значения платформ радиуса`() {
        assertEquals(
            SizeTokenValue.Dimension(20, mapOf(NativePlatform.ANDROID to 18)),
            valid(radius, """{"valuePx":20,"platforms":{"android":18,"ios":null}}"""),
        )
        assertEquals("platforms.web", invalid(radius, """{"valuePx":20,"platforms":{"web":1}}""").field)
        assertEquals(
            violation("platforms.android", SizeValueParser.NOT_INTEGER),
            invalid(radius, """{"valuePx":20,"platforms":{"android":1.5}}"""),
        )
        assertEquals("platforms", invalid(radius, """{"valuePx":20,"platforms":[1]}""").field)
    }

    @Test
    fun `тело не того вида`() {
        assertEquals("layers", invalid(radius, """{"valuePx":1,"layers":[]}""").field)
        assertEquals("fallbackElevation", invalid(spacing, """{"valuePx":1,"fallbackElevation":2}""").field)
        assertEquals("valuePx", invalid(shadow, """{"valuePx":1,"layers":[$LAYER]}""").field)
    }

    @Test
    fun `тень — от одного до четырёх слоёв с целыми числами и цветом Hex`() {
        val layer = ShadowLayer(0, 4, 14, -4, "#08080814")
        assertEquals(
            SizeTokenValue.Shadow(listOf(layer), 4),
            valid(shadow, """{"layers":[$LAYER],"fallbackElevation":4}"""),
        )
        assertEquals(SizeTokenValue.Shadow(listOf(layer), 0), valid(shadow, """{"layers":[$LAYER]}"""))
        assertEquals(violation("layers", SizeValueParser.NO_LAYERS), invalid(shadow, """{"layers":[]}"""))
        assertEquals(violation("layers", SizeValueParser.NO_LAYERS), invalid(shadow, """{}"""))
        val five = List(5) { LAYER }.joinToString(",")
        assertEquals(violation("layers", SizeValueParser.TOO_MANY_LAYERS), invalid(shadow, """{"layers":[$five]}"""))
        val red = LAYER.replace("#08080814", "red")
        assertEquals(violation("layers[0].color", SizeValueParser.NOT_HEX), invalid(shadow, """{"layers":[$red]}"""))
        val negativeBlur = LAYER.replace("\"blur\":14", "\"blur\":-1")
        assertEquals(
            violation("layers[1].blur", "Значение должно быть в диапазоне 0–200 px."),
            invalid(shadow, """{"layers":[$LAYER,$negativeBlur]}"""),
        )
        val farOffset = LAYER.replace("\"offsetX\":0", "\"offsetX\":201")
        assertEquals(
            violation("layers[0].offsetX", "Значение должно быть в диапазоне -200–200 px."),
            invalid(shadow, """{"layers":[$farOffset]}"""),
        )
        assertEquals(
            violation("fallbackElevation", "Значение должно быть в диапазоне 0–24 px."),
            invalid(shadow, """{"layers":[$LAYER],"fallbackElevation":25}"""),
        )
    }

    @Test
    fun `свои слои платформы у тени`() {
        val value = valid(shadow, """{"layers":[$LAYER],"platforms":{"ios":{"layers":[$LAYER,$LAYER]}}}""")
        assertEquals(2, assertIs<SizeTokenValue.Shadow>(value).platforms.getValue(NativePlatform.IOS).size)
        assertEquals(
            violation("platforms.ios.layers", SizeValueParser.NO_LAYERS),
            invalid(shadow, """{"layers":[$LAYER],"platforms":{"ios":{"layers":[]}}}"""),
        )
        assertEquals("platforms.android", invalid(shadow, """{"layers":[$LAYER],"platforms":{"android":1}}""").field)
    }

    @Test
    fun `варианты нового размера тени`() {
        fun variant(name: String) = """{"variant":"$name","layers":[$LAYER],"fallbackElevation":2}"""
        val all = SizeTokenNaming.SHADOW_VARIANTS.joinToString(",") { variant(it) }
        val parsed = assertIs<SizeValueCheck.Valid<List<ShadowVariantValue>>>(variants("""{"variants":[$all]}"""))
        assertEquals(SizeTokenNaming.SHADOW_VARIANTS, parsed.value.map(ShadowVariantValue::variant))

        val three = SizeTokenNaming.SHADOW_VARIANTS.drop(1).joinToString(",") { variant(it) }
        assertEquals("variants", variantField("""{"variants":[$three]}"""))
        assertEquals("variants", variantField("""{"variants":[$all,${variant("up.hard")}]}"""))
        val badLayer = all.replaceFirst("#08080814", "x")
        assertEquals("variants[0].layers[0].color", variantField("""{"variants":[$badLayer]}"""))
    }

    private fun violation(field: String, message: String) = SizeValueViolation(field, message)

    private fun valid(kind: SizeTokenKind, body: String): SizeTokenValue =
        assertIs<SizeValueCheck.Valid<SizeTokenValue>>(SizeValueParser.parse(kind, input(body))).value

    private fun invalid(kind: SizeTokenKind, body: String): SizeValueViolation =
        assertIs<SizeValueCheck.Invalid>(SizeValueParser.parse(kind, input(body))).violation

    private fun variants(body: String) = SizeValueParser.variants(input(body))

    private fun variantField(body: String) = assertIs<SizeValueCheck.Invalid>(variants(body)).violation.field

    private fun input(body: String): SizeValueInput {
        val fields = Json.parseToJsonElement(body) as JsonObject
        return SizeValueInput(
            valuePx = fields["valuePx"],
            layers = fields["layers"],
            fallbackElevation = fields["fallbackElevation"],
            platforms = fields["platforms"],
            variants = fields["variants"],
        )
    }

    private companion object {
        const val LAYER = """{"offsetX":0,"offsetY":4,"blur":14,"spread":-4,"color":"#08080814"}"""
    }
}
