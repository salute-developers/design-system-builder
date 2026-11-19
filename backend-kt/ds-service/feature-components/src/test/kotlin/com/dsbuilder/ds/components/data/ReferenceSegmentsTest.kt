package com.dsbuilder.ds.components.data

import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ReferenceSegmentsTest {
    private val size = UUID.randomUUID()
    private val gap = UUID.randomUUID()
    private val shape = UUID.randomUUID()
    private val other = UUID.randomUUID()
    private val names = mapOf("l" to size, "none" to gap, "default" to shape)

    private fun resolve(tail: String, authored: Map<String, List<UUID>> = emptyMap()) =
        ReferenceSegments.resolve(tail.split('.'), names::get, authored)

    @Test
    fun `names alone cover the tail`() {
        assertEquals(listOf(size, gap, shape), resolve("l.none.default"))
    }

    @Test
    fun `an authored identifier of several segments is one group`() {
        assertEquals(
            listOf(size, gap, shape),
            resolve("l.no-gap.default", mapOf("l.no-gap.default" to listOf(size, gap, shape))),
        )
    }

    @Test
    fun `an authored identifier and a name are combined in order of the segments`() {
        assertEquals(listOf(gap, shape), resolve("no-gap.default", mapOf("no-gap" to listOf(gap))))
    }

    @Test
    fun `the longest group wins over shorter ones`() {
        val authored = mapOf("l.none" to listOf(other), "l" to listOf(size), "none" to listOf(gap))
        assertEquals(listOf(other, shape), resolve("l.none.default", authored))
    }

    @Test
    fun `a name wins over an authored identifier of the same length`() {
        assertEquals(listOf(size), resolve("l", mapOf("l" to listOf(other))))
    }

    @Test
    fun `a longer group that leaves a tail nobody covers is abandoned for a split that works`() {
        val authored = mapOf("a.b" to listOf(other), "a" to listOf(size), "b.c" to listOf(gap))
        assertEquals(listOf(size, gap), ReferenceSegments.resolve(listOf("a", "b", "c"), { null }, authored))
    }

    @Test
    fun `a tail that no split covers is not resolved`() {
        assertNull(resolve("l.no-gap.missing", mapOf("no-gap" to listOf(gap))))
    }

    @Test
    fun `an empty tail is covered by no groups`() {
        assertEquals(emptyList(), ReferenceSegments.resolve(emptyList(), names::get, emptyMap()))
    }
}
