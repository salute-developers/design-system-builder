package com.dsbuilder.ds.themes.domain.colortokens

import com.dsbuilder.ds.themes.domain.tokengroups.Ordering
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroupRules
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Имена членов семейства при переносе и переименовании, правила групп и порядок соседей. */
class ColorTokenNamingTest {
    @Test
    fun `переименование сохраняет контекст и состояние`() {
        assertEquals(
            "surface.on-dark.brand-hover",
            ColorTokenNaming.rename("text.on-dark.accent-hover", "surface", "brand"),
        )
        assertEquals("text.default.brand", ColorTokenNaming.rename("text.default.accent", "text", "brand"))
        assertEquals(
            "text.inverse.minor-brightness",
            ColorTokenNaming.rename("text.inverse.accent-brightness", "text", "minor"),
        )
        assertEquals("outline.default.accent", ColorTokenNaming.withGroup("text.default.accent", "outline"))
    }

    @Test
    fun `отображаемое имя по правилу сида`() {
        assertEquals("textAccentHover", ColorTokenNaming.displayName("text.default.accent-hover"))
        assertEquals("onDarkTextAccent", ColorTokenNaming.displayName("text.on-dark.accent"))
        assertEquals("inverseTextAccentMinorActive", ColorTokenNaming.displayName("text.inverse.accent-minor-active"))
        assertEquals("darkBackgroundPrimary", ColorTokenNaming.displayName("background.dark.primary"))
        assertEquals("surfaceTransparentAccent", ColorTokenNaming.displayName("surface.default.transparent-accent"))
    }

    @Test
    fun `код группы из названия`() {
        assertEquals("brand", TokenGroupRules.codeFromLabel("Brand"))
        assertEquals("text-icons", TokenGroupRules.codeFromLabel("Text & Icons"))
        assertEquals("brand-2", TokenGroupRules.codeFromLabel("  Brand 2 "))
        assertNull(TokenGroupRules.codeFromLabel("Бренд"))
        assertNotNull(TokenGroupRules.label(" "))
        assertNull(TokenGroupRules.label("Бренд"))
        assertTrue(TokenGroupRules.sameLabel("Accent ", "accent"))
    }

    @Test
    fun `позиция среди соседей`() {
        assertEquals(listOf("a", "x", "b"), Ordering.place(listOf("a", "b"), "x", 1))
        assertEquals(listOf("a", "b", "x"), Ordering.place(listOf("a", "b"), "x", null))
        assertEquals(listOf("a", "b", "x"), Ordering.place(listOf("a", "b"), "x", 10))
        assertEquals(listOf("b", "a"), Ordering.place(listOf("a", "b"), "b", 0))
    }
}
