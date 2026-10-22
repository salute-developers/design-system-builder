package com.dsbuilder.ds.themes.domain.typography

import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/** Разбор имени стиля, перевод значений в формат платформ, проверка значений и подсчёт использования. */
class TypographyDomainTest {
    @Test
    fun `имя токена стиля разбирается по правилу`() {
        val name = TypographyTokenName.parse("screen-m.body.m.bold")
        assertEquals(TypographyScreen.M, name?.screen)
        assertEquals(TypographyStyleKey("body", "m"), name?.style)
        assertEquals(TypographyVariant.BOLD, name?.variant)
        assertEquals("screen-m.body.m.bold", name.toString())

        assertNull(TypographyTokenName.parse("screen-xl.body.m.bold"))
        assertNull(TypographyTokenName.parse("screen-m.body.m.italic"))
        assertNull(TypographyTokenName.parse("body.m.bold"))
        assertNull(TypographyTokenName.parse("screen-m.Body.m.bold"))
    }

    @Test
    fun `ссылка компонента на стиль — с экраном или без`() {
        val key = TypographyStyleKey("body", "l")
        assertEquals(key to TypographyVariant.BOLD, TypographyTokenName.reference("body.l.bold"))
        assertEquals(key to TypographyVariant.MEDIUM, TypographyTokenName.reference("screen-l.body.l.medium"))
        assertNull(TypographyTokenName.reference("surface.default.solid"))
        assertNull(TypographyTokenName.reference("body.l"))
    }

    @Test
    fun `стили сортируются по группам и размерам`() {
        val keys = listOf(
            TypographyStyleKey("text", "s"),
            TypographyStyleKey("header", "h2"),
            TypographyStyleKey("body", "xxs"),
            TypographyStyleKey("header", "h10"),
            TypographyStyleKey("display", "l"),
            TypographyStyleKey("body", "l"),
        )
        val expected = listOf("display.l", "header.h2", "header.h10", "body.l", "body.xxs", "text.s")
        assertEquals(expected, keys.sorted().map { "$it" })
    }

    @Test
    fun `значения читаются в px из веба`() {
        val metrics = TypographyPlatformValues.read(
            mapOf(
                ThemeTokenPlatform.WEB to json(
                    """[{"fontSize":"1.125rem","lineHeight":"1.375rem","letterSpacing":"-0.02em",""" +
                        """"fontWeight":"600","fontFamilyRef":"fontFamily.body"}]""",
                ),
            ),
        )
        assertEquals(TypographyMetrics(18.0, 22.0, -0.02, 600, "body"), metrics)

        val normal = TypographyPlatformValues.read(
            mapOf(
                ThemeTokenPlatform.WEB to json("""[{"letterSpacing":"normal","fontWeight":"bold"}]"""),
                ThemeTokenPlatform.ANDROID to json("""[{"textSize":16,"lineHeight":20}]"""),
            ),
        )
        assertEquals(0.0, normal.letterSpacingEm)
        assertEquals(700, normal.weight)
        assertEquals(16.0, normal.sizePx)
    }

    @Test
    fun `запись переводит значения в формат платформ и сохраняет остальные поля`() {
        val change = TypographyTokenChange(18.0, 22.0, -0.02, 600, "display")
        val web = TypographyPlatformValues.write(
            json("""[{"fontSize":"1rem","fontStyle":"normal"}]"""),
            ThemeTokenPlatform.WEB,
            change,
        )
        assertEquals(
            json(
                """[{"fontSize":"1.125rem","fontStyle":"normal","lineHeight":"1.375rem","letterSpacing":"-0.02em",""" +
                    """"fontWeight":"600","fontFamilyRef":"fontFamily.display"}]""",
            ),
            web,
        )
        val android = TypographyPlatformValues.write(null, ThemeTokenPlatform.ANDROID, change)
        assertEquals(
            json(
                """[{"textSize":18,"lineHeight":22,"letterSpacing":-0.02,"fontWeight":600,""" +
                    """"fontFamilyRef":"fontFamily.display"}]""",
            ),
            android,
        )
        val ios = TypographyPlatformValues.write(
            json("""[{"size":16,"style":"normal","weight":"regular"}]"""),
            ThemeTokenPlatform.IOS,
            change.copy(weight = 100),
        )
        assertEquals(
            json(
                """[{"size":18,"style":"normal","weight":"thin","lineHeight":22,"kerning":-0.02,""" +
                    """"fontFamilyRef":"fontFamily.display"}]""",
            ),
            ios,
        )
        val zeroChange = TypographyTokenChange(letterSpacingEm = 0.0)
        val zero = TypographyPlatformValues.write(null, ThemeTokenPlatform.WEB, zeroChange)
        assertEquals(json("""[{"letterSpacing":"normal"}]"""), zero)
        assertEquals("0.8125rem", TypographyPlatformValues.rem(13.0))
        assertEquals("1rem", TypographyPlatformValues.rem(16.0))
        assertEquals("ultraLight", TypographyPlatformValues.IOS_WEIGHTS[200])
        assertEquals("bold", TypographyPlatformValues.IOS_WEIGHTS[700])
        assertEquals("heavy", TypographyPlatformValues.IOS_WEIGHTS[800])
    }

    @Test
    fun `проверка значений`() {
        assertNull(TypographyValueRules.validate(16.0, 20.0, -0.2, mapOf(TypographyVariant.BOLD to 900)))
        assertEquals("size", TypographyValueRules.validate(-5.0, null, null, emptyMap())?.field)
        val lineHeight = TypographyValueRules.validate(null, 0.0, null, emptyMap())
        assertEquals(TypographyValueRules.SIZE_MESSAGE, lineHeight?.message)
        assertEquals("letterSpacing", TypographyValueRules.validate(null, null, 1.5, emptyMap())?.field)
        val weight = TypographyValueRules.validate(null, null, null, mapOf(TypographyVariant.MEDIUM to 450))
        assertEquals(TypographyValueViolation("weights.medium", TypographyValueRules.WEIGHT_MESSAGE), weight)
        val heavy = TypographyValueRules.validate(null, null, null, mapOf(TypographyVariant.BOLD to 1000))
        assertEquals("weights.bold", heavy?.field)
    }

    @Test
    fun `использование считается по стилю без экрана`() {
        val usage = TypographyUsage.count(
            listOf(
                ComponentPropertyReference("Button", "body.l.bold"),
                ComponentPropertyReference("Select", "body.l.normal"),
                ComponentPropertyReference("Button", "body.l.bold"),
                ComponentPropertyReference("Button", "screen-s.body.l.medium"),
                ComponentPropertyReference("Button", "surface.default.solid"),
            ),
        )
        assertEquals(
            listOf(TypographyComponentUsage("Button", 3), TypographyComponentUsage("Select", 1)),
            usage[TypographyStyleKey("body", "l")],
        )
        assertEquals(1, usage.size)
    }

    private fun json(value: String): JsonElement = Json.parseToJsonElement(value)
}
