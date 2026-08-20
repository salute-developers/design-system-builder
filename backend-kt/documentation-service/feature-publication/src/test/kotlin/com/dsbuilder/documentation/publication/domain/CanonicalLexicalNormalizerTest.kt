package com.dsbuilder.documentation.publication.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class CanonicalLexicalNormalizerTest {
    @Test
    fun `preserves technical punctuation and splits identifiers`() {
        val result = CanonicalLexicalNormalizer.normalize("  com.sdds.AvatarStyles size-72_color?  ")!!

        assertEquals("com.sdds.avatarstyles size-72_color?", result.exact)
        assertEquals(listOf("com", "sdds", "avatar", "styles", "size", "72", "color"), result.tokens)
    }

    @Test
    fun `normalizes unicode and whitespace deterministically`() {
        val first = CanonicalLexicalNormalizer.normalize("Ａvatar\n\tКНОПКА")
        val retry = CanonicalLexicalNormalizer.normalize("Ａvatar\n\tКНОПКА")

        assertEquals("avatar кнопка", first?.exact)
        assertEquals(first, retry)
    }

    @Test
    fun `rejects empty and punctuation only input`() {
        assertNull(CanonicalLexicalNormalizer.normalize(" \n "))
        assertNull(CanonicalLexicalNormalizer.normalize(".-_:@?"))
    }
}
