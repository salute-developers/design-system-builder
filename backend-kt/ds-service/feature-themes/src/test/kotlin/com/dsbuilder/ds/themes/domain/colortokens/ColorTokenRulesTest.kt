package com.dsbuilder.ds.themes.domain.colortokens

import com.dsbuilder.ds.themes.domain.ThemePaletteType
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.palette.PaletteRampRef
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ColorTokenRulesTest {
    private val accent = ColorTokenFamily(ThemeTokenType.COLOR, "text", "accent")

    @Test
    fun `family members cover subgroups and states`() {
        listOf(
            "text.default.accent",
            "text.on-dark.accent",
            "text.on-light.accent",
            "text.inverse.accent",
            "text.default.accent-hover",
            "text.inverse.accent-active",
            "text.default.accent-brightness",
        ).forEach { assertTrue(accent.memberOf(ThemeTokenType.COLOR, it), it) }
        assertEquals("text.default.accent", accent.defaultMember())
        assertFalse(accent.memberOf(ThemeTokenType.COLOR, "text.default.accent-minor"))
        assertFalse(accent.memberOf(ThemeTokenType.COLOR, "surface.default.accent"))
        assertFalse(accent.memberOf(ThemeTokenType.GRADIENT, "text.default.accent"))
    }

    @Test
    fun `background uses dark and light subgroups`() {
        val primary = ColorTokenFamily(ThemeTokenType.COLOR, "background", "primary")
        assertEquals(primary, ColorTokenFamily.of(ThemeTokenType.COLOR, "background.dark.primary"))
        assertEquals(primary, ColorTokenFamily.of(ThemeTokenType.COLOR, "background.light.primary"))
        assertNull(ColorTokenFamily.of(ThemeTokenType.COLOR, "background.on-dark.primary"))
        assertNull(ColorTokenFamily.of(ThemeTokenType.COLOR, "text.dark.primary"))
    }

    @Test
    fun `names outside the family rule have no family`() {
        assertEquals(
            ColorTokenFamily(ThemeTokenType.COLOR, "data", "yellow-transparent"),
            ColorTokenFamily.of(ThemeTokenType.COLOR, "data.default.yellow-transparent"),
        )
        assertNull(ColorTokenFamily.of(ThemeTokenType.COLOR, "text.accent"))
        assertNull(ColorTokenFamily.of(ThemeTokenType.COLOR, "text.default.accent.extra"))
        assertNull(ColorTokenFamily.of(ThemeTokenType.COLOR, "text.unknown.accent"))
        assertNull(ColorTokenFamily.of(ThemeTokenType.TYPOGRAPHY, "text.default.accent"))
    }

    @Test
    fun `token names reject modes and invalid characters`() {
        assertNull(TokenNameRule.validate("surface.default.read-only"))
        assertNotNull(TokenNameRule.validate(""))
        assertNotNull(TokenNameRule.validate("dark.text.default.accent"))
        assertNotNull(TokenNameRule.validate("light.text.accent"))
        assertNotNull(TokenNameRule.validate("text.default.Accent"))
        assertNotNull(TokenNameRule.validate("text.default.accent_minor"))
        assertNotNull(TokenNameRule.validate("text..accent"))
        assertTrue(TokenNameRule.validSegment("accent-minor"))
        assertFalse(TokenNameRule.validSegment("-accent"))
    }

    @Test
    fun `color values accept hex palette steps and palette ids`() {
        val rule = TokenValueRule(mapOf(PaletteRampRef(ThemePaletteType.GENERAL, "green") to mapOf(500 to "#00FF00")))
        listOf("#abc", "#AABBCC", "#aabbcc80").forEach { assertNull(color(rule, string(it)), it) }
        assertNull(color(rule, array("#AABBCC")))
        assertNull(color(rule, array("[general.green.500]")))
        assertNull(color(rule, array("[general.green.500][0]")))
        assertNull(color(rule, array("[general.green.500][1]")))
        assertNull(color(rule, array("[general.green.500][0.56]")))
        assertNotNull(color(rule, array("[general.green.400]")))
        assertNotNull(color(rule, array("[additional.green.500]")))
        assertNotNull(color(rule, array("[general.green.500][1.5]")))
        assertNotNull(color(rule, array("[general.green.99999999999]")))
        assertNotNull(color(rule, array("#abcd")))
        assertNotNull(color(rule, array("red")))
        assertNotNull(color(rule, JsonArray(listOf(string("#fff"), string("#000")))))
        assertNotNull(color(rule, JsonPrimitive(1)))
        assertNotNull(color(rule, JsonObject(emptyMap())))
        assertNull(paletteId(rule, JsonNull))
        assertNull(paletteId(rule, JsonArray(emptyList())))
        assertNull(paletteId(rule, array("0.56")))
        assertNull(paletteId(rule, JsonArray(listOf(JsonPrimitive(1)))))
        assertNotNull(paletteId(rule, array("2")))
        assertNotNull(paletteId(rule, array("#fff")))
    }

    @Test
    fun `gradient values check web layers only`() {
        val rule = TokenValueRule(emptyMap())
        assertNull(gradient(rule, ThemeTokenPlatform.WEB, array("linear-gradient(90deg, #FFFFFF 0%, #000000 100%)")))
        assertNull(gradient(rule, ThemeTokenPlatform.WEB, array("radial-gradient(#fff, #000)", "#FFFFFF")))
        assertNotNull(gradient(rule, ThemeTokenPlatform.WEB, array("[general.green.500]")))
        assertNotNull(gradient(rule, ThemeTokenPlatform.WEB, JsonArray(emptyList())))
        assertNotNull(gradient(rule, ThemeTokenPlatform.WEB, string("linear-gradient(#fff, #000)")))
        assertNull(gradient(rule, ThemeTokenPlatform.IOS, JsonArray(listOf(JsonObject(emptyMap())))))
        assertNotNull(gradient(rule, ThemeTokenPlatform.ANDROID, string("x")))
    }

    @Test
    fun `other token types are not checked`() {
        val rule = TokenValueRule(emptyMap())
        assertNull(rule.validate(ThemeTokenType.TYPOGRAPHY, ThemeTokenPlatform.WEB, false, string("anything")))
    }

    private fun color(rule: TokenValueRule, value: JsonElement) =
        rule.validate(ThemeTokenType.COLOR, ThemeTokenPlatform.WEB, false, value)

    private fun paletteId(rule: TokenValueRule, value: JsonElement) =
        rule.validate(ThemeTokenType.COLOR, ThemeTokenPlatform.WEB, true, value)

    private fun gradient(rule: TokenValueRule, platform: ThemeTokenPlatform, value: JsonElement) =
        rule.validate(ThemeTokenType.GRADIENT, platform, false, value)

    private fun string(value: String) = JsonPrimitive(value)

    private fun array(vararg values: String) = JsonArray(values.map(::JsonPrimitive))
}
