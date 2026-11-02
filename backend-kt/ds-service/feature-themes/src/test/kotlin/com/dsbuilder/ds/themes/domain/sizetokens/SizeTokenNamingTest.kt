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
        // Имя тени произвольное: не только варианты размера `down|up.soft|hard.<размер>`.
        assertEquals(SizeTokenKind.SHADOW, SizeTokenNaming.kindOf(ThemeTokenType.SHADOW, "card"))
        assertEquals(SizeTokenKind.SHADOW, SizeTokenNaming.kindOf(ThemeTokenType.SHADOW, "elevated.focus-ring"))
        assertEquals(SizeTokenKind.SHADOW, SizeTokenNaming.kindOf(ThemeTokenType.SHADOW, "left.soft.s"))
    }

    @Test
    fun `имя вне правила своего типа не входит в раздел`() {
        assertNull(SizeTokenNaming.kindOf(ThemeTokenType.SHAPE, "spacing.4x"))
        assertNull(SizeTokenNaming.kindOf(ThemeTokenType.SPACING, "round.m"))
        assertNull(SizeTokenNaming.kindOf(ThemeTokenType.SHAPE, "round.M"))
        assertNull(SizeTokenNaming.kindOf(ThemeTokenType.SHAPE, "round.m.x"))
        assertNull(SizeTokenNaming.kindOf(ThemeTokenType.SHADOW, "Card"))
        assertNull(SizeTokenNaming.kindOf(ThemeTokenType.SHADOW, "card..m"))
        assertNull(SizeTokenNaming.kindOf(ThemeTokenType.SHADOW, "card_m"))
        assertNull(SizeTokenNaming.kindOf(ThemeTokenType.COLOR, "round.m"))
        assertNull(SizeTokenNaming.kindOf(null, "round.m"))
    }

    @Test
    fun `полное имя нового токена, у тени — само имя`() {
        assertEquals("card", SizeTokenNaming.fullName(SizeTokenKind.SHADOW, "card"))
        assertEquals("round.xxxl", SizeTokenNaming.fullName(SizeTokenKind.RADIUS, "xxxl"))
        assertEquals("spacing.14x", SizeTokenNaming.fullName(SizeTokenKind.SPACING, "14x"))
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
        assertTrue(SizeTokenNaming.validName(SizeTokenKind.SHADOW, "elevated.focus"))
        assertFalse(SizeTokenNaming.validName(SizeTokenKind.SHADOW, "elevated."))
        assertFalse(SizeTokenNaming.validName(SizeTokenKind.RADIUS, "x.l"))
        assertEquals(SizeTokenNaming.variableKey("down.soft.m"), SizeTokenNaming.variableKey("down-soft-m"))
    }

    @Test
    fun `отображаемое имя по правилу сида`() {
        assertEquals("roundM", SizeTokenNaming.displayName("round.m"))
        assertEquals("spacing4x", SizeTokenNaming.displayName("spacing.4x"))
        assertEquals("downSoftXl", SizeTokenNaming.displayName("down.soft.xl"))
        assertEquals("roundExtraL", SizeTokenNaming.displayName("round.extra-l"))
    }
}
