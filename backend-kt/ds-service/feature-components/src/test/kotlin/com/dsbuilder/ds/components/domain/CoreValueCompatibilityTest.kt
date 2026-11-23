package com.dsbuilder.ds.components.domain

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class CoreValueCompatibilityTest {
    @Test
    fun `token families permit supported conversions without accepting unrelated types`() {
        listOf("dimension" to "spacing", "integer" to "float", "value" to "integer", "color" to "gradient")
            .forEach { (property, token) -> assertTrue(CoreValueCompatibility.tokenFits(property, token)) }
        listOf("spacing" to "dimension", "dimension" to "color", "color" to "typography")
            .forEach { (property, token) -> assertFalse(CoreValueCompatibility.tokenFits(property, token)) }
    }

    @Test
    fun `unknown token metadata is not a conflict but different known names remain incompatible`() {
        assertTrue(CoreValueCompatibility.tokenFits("color", null))
        assertTrue(CoreValueCompatibility.tokenFits("custom", "custom"))
        assertFalse(CoreValueCompatibility.tokenFits("custom", "other"))
    }

    @Test
    fun `native fractional values are finite numbers while web keeps CSS expressions`() {
        listOf("dimension", "float").forEach { type ->
            assertTrue(CoreValueCompatibility.literalFits(type, "1.5", "compose"))
            assertFalse(CoreValueCompatibility.literalFits(type, "NaN", "compose"))
            assertFalse(CoreValueCompatibility.literalFits(type, "Infinity", "compose"))
            assertFalse(CoreValueCompatibility.literalFits(type, "auto", "compose"))
            assertTrue(CoreValueCompatibility.literalFits(type, "auto", "web"))
        }
        assertFalse(CoreValueCompatibility.literalFits("integer", "1.5", "compose"))
        assertTrue(CoreValueCompatibility.literalFits("integer", "calc(100% - 1px)", "web"))
        assertTrue(CoreValueCompatibility.literalFits("value", "enum-value", "compose"))
    }
}
