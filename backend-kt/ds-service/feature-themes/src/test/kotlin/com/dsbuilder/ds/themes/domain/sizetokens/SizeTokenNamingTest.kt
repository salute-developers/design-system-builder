package com.dsbuilder.ds.themes.domain.sizetokens

import com.dsbuilder.ds.themes.domain.ThemeTokenType
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Правила имён радиусов, отступов и теней, размер тени и полное скругление. */
class SizeTokenNamingTest {
    @Test
    fun `тип и имя определяют раздел`() {
        assertEquals(SizeTokenKind.RADIUS, SizeTokenNaming.kindOf(ThemeTokenType.SHAPE, "round.m"))
        assertEquals(SizeTokenKind.RADIUS, SizeTokenNaming.kindOf(ThemeTokenType.SHAPE, "round.circle"))
        assertEquals(SizeTokenKind.SPACING, SizeTokenNaming.kindOf(ThemeTokenType.SPACING, "spacing.4x"))
        assertEquals(SizeTokenKind.SHADOW, SizeTokenNaming.kindOf(ThemeTokenType.SHADOW, "down.soft.s"))
        assertEquals(SizeTokenKind.SHADOW, SizeTokenNaming.kindOf(ThemeTokenType.SHADOW, "up.hard.extra-l"))
    }

    @Test
    fun `имя вне правила своего типа не входит в раздел`() {
        assertNull(SizeTokenNaming.kindOf(ThemeTokenType.SHAPE, "spacing.4x"))
        assertNull(SizeTokenNaming.kindOf(ThemeTokenType.SPACING, "round.m"))
        assertNull(SizeTokenNaming.kindOf(ThemeTokenType.SHAPE, "round.M"))
        assertNull(SizeTokenNaming.kindOf(ThemeTokenType.SHAPE, "round.m.x"))
        assertNull(SizeTokenNaming.kindOf(ThemeTokenType.SHADOW, "left.soft.s"))
        assertNull(SizeTokenNaming.kindOf(ThemeTokenType.SHADOW, "down.medium.s"))
        assertNull(SizeTokenNaming.kindOf(ThemeTokenType.COLOR, "round.m"))
        assertNull(SizeTokenNaming.kindOf(null, "round.m"))
    }

    @Test
    fun `размер тени — четыре варианта с общим последним сегментом`() {
        assertEquals("m", SizeTokenNaming.shadowSize("up.hard.m"))
        assertEquals("up.hard", SizeTokenNaming.shadowVariant("up.hard.m"))
        assertEquals(
            listOf("down.soft.m", "down.hard.m", "up.soft.m", "up.hard.m"),
            SizeTokenNaming.shadowSizeNames("m"),
        )
        assertEquals(SizeTokenNaming.shadowSizeNames("xl"), SizeTokenNaming.fullNames(SizeTokenKind.SHADOW, "xl"))
        assertEquals(listOf("round.xxxl"), SizeTokenNaming.fullNames(SizeTokenKind.RADIUS, "xxxl"))
        assertEquals(listOf("spacing.14x"), SizeTokenNaming.fullNames(SizeTokenKind.SPACING, "14x"))
    }

    @Test
    fun `полное скругление и сегмент имени`() {
        assertTrue(SizeTokenNaming.isFullRounding("round.circle"))
        assertFalse(SizeTokenNaming.isFullRounding("round.m"))
        assertTrue(SizeTokenNaming.validSegment("extra-l"))
        assertFalse(SizeTokenNaming.validSegment(""))
        assertFalse(SizeTokenNaming.validSegment("Xl"))
        assertFalse(SizeTokenNaming.validSegment("x.l"))
        assertFalse(SizeTokenNaming.validSegment("x_l"))
    }

    @Test
    fun `отображаемое имя по правилу сида`() {
        assertEquals("roundM", SizeTokenNaming.displayName("round.m"))
        assertEquals("spacing4x", SizeTokenNaming.displayName("spacing.4x"))
        assertEquals("downSoftXl", SizeTokenNaming.displayName("down.soft.xl"))
        assertEquals("roundExtraL", SizeTokenNaming.displayName("round.extra-l"))
    }
}
