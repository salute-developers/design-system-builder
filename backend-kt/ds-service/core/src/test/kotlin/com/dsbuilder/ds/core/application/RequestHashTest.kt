package com.dsbuilder.ds.core.application

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals

class RequestHashTest {
    @Test
    fun `canonical hash distinguishes values that collide in data class toString`() {
        val first = CollisionCommand(
            name = "x, projectName=y",
            projectName = "z",
            description = "d",
        )
        val second = CollisionCommand(
            name = "x",
            projectName = "y, projectName=z",
            description = "d",
        )

        assertEquals(first.toString(), second.toString())
        assertNotEquals(RequestHash.canonical(first), RequestHash.canonical(second))
    }

    @Test
    fun `canonical hash is deterministic for nested structures and unordered values`() {
        val first = NestedCommand(listOf("a", "b"), linkedMapOf("x" to 1, "y" to 2), setOf("a", "b"))
        val second = NestedCommand(listOf("a", "b"), linkedMapOf("y" to 2, "x" to 1), setOf("b", "a"))

        assertEquals(RequestHash.canonical(first), RequestHash.canonical(second))
    }

    private data class CollisionCommand(
        val name: String,
        val projectName: String,
        val description: String,
    )

    private data class NestedCommand(
        val values: List<String>,
        val mapping: Map<String, Int>,
        val flags: Set<String>,
    )
}
