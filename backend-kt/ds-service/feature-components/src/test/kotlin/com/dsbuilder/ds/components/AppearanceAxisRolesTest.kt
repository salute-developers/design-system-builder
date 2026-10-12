package com.dsbuilder.ds.components

import com.dsbuilder.ds.components.domain.RootCandidate
import com.dsbuilder.ds.components.domain.fallbackRoot
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class AppearanceAxisRolesTest {
    private fun axes(vararg names: String) = names.mapIndexed { index, name -> RootCandidate(name, name, index) }

    @Test
    fun `size axis wins over earlier axes`() {
        assertEquals("size", fallbackRoot(axes("shape", "size", "view"), colorScheme = null))
    }

    @Test
    fun `first axis by position is taken when there is no size`() {
        assertEquals("shape", fallbackRoot(axes("shape", "state"), colorScheme = null))
    }

    @Test
    fun `colour scheme axis is never a fallback root`() {
        assertEquals("shape", fallbackRoot(axes("view", "shape"), colorScheme = "view"))
        assertEquals("size", fallbackRoot(axes("size", "shape"), colorScheme = "view"))
        assertNull(fallbackRoot(axes("size"), colorScheme = "size"))
    }

    @Test
    fun `candidates are ordered by position, not by list order`() {
        val candidates = listOf(RootCandidate("b", "b", 1), RootCandidate("a", "a", 0))
        assertEquals("a", fallbackRoot(candidates, colorScheme = null))
    }

    @Test
    fun `excluded axis is skipped`() {
        assertEquals("shape", fallbackRoot(axes("size", "shape"), colorScheme = null, excluded = "size"))
    }

    @Test
    fun `no axes means no root`() {
        assertNull(fallbackRoot(axes(), colorScheme = null))
    }
}
