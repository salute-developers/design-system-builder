package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.PropertyValueRepository
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class PatchedPropertyValueTest {
    private val token = UUID.randomUUID()
    private val states = UUID.randomUUID()
    private val original = PatchedPropertyValue(token, "24", "0.5", "2", states)

    @Test
    fun `omitted patch fields preserve the current assignment including its state set`() {
        val omitted = patch().copy(tokenId = UUID.randomUUID(), value = "ignored", alpha = "ignored")
        assertEquals(original, original.apply(omitted))
        assertEquals(original, original.apply(null))
    }

    @Test
    fun `explicit null clears token literal alpha and adjustment`() {
        val cleared = original.apply(
            patch().copy(tokenIdPresent = true, valuePresent = true, alphaPresent = true, adjustmentPresent = true),
        )
        assertNull(cleared.tokenId)
        assertNull(cleared.literal)
        assertNull(cleared.storedLiteral)
        assertNull(cleared.alpha)
        assertNull(cleared.adjustment)
        assertEquals(states, cleared.stateSetId)
    }

    @Test
    fun `switching from token to literal keeps the submitted literal for Core validation and storage`() {
        val nextStates = UUID.randomUUID()
        val literal = original.apply(
            patch().copy(tokenIdPresent = true, value = "32", valuePresent = true, stateSetId = nextStates),
        )
        assertNull(literal.tokenId)
        assertEquals("32", literal.literal)
        assertEquals("32", literal.storedLiteral)
        assertEquals(nextStates, literal.stateSetId)
        assertEquals("32", literal.copy(tokenId = token).literal)
        assertNull(literal.copy(tokenId = token).storedLiteral)
    }

    private fun patch() = PropertyValueRepository.ValueUpdate(
        tokenId = null, tokenIdPresent = false, value = null, valuePresent = false,
        alpha = null, alphaPresent = false, adjustment = null, adjustmentPresent = false, stateSetId = null,
    )
}
