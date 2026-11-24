package com.dsbuilder.frontend.plugin.androidstudio.ui

import com.dsbuilder.frontend.plugin.androidstudio.components.CatalogComponent
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotSame
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ComponentsStateTest {
    @Test
    fun selectionRevisionInvalidatesAnOldCopyEvenAfterReturningToTheSameConfiguration() {
        val state = ComponentsState()
        state.configurationName = "first"
        val revision = state.revision
        state.configurationName = "second"
        state.configurationName = "first"
        assertTrue(state.revision > revision)
    }

    @Test
    fun navigationResetClearsComponentAndQueryTogetherWithTheSection() {
        val state = MainScreenState()
        state.sectionIndex = 1
        val components = state.components
        components.selected = CatalogComponent("id", "BasicButton")
        components.query = "button"
        components.selections = mapOf("size" to "m")
        state.reset()
        assertEquals(0, state.sectionIndex)
        assertNotSame(components, state.components)
        assertNull(state.components.selected)
        assertEquals("", state.components.query)
        assertTrue(state.components.selections.isEmpty())
    }

    @Test
    fun componentSearchIgnoresCaseAndSurroundingWhitespaceAndKeepsOrder() {
        val components = listOf(CatalogComponent("a", "BasicButton"), CatalogComponent("b", "IconButton"))
        assertEquals(components, searchComponents(components, "  "))
        assertEquals(components, searchComponents(components, " BUTTON "))
        assertEquals(listOf(components[1]), searchComponents(components, "icon"))
        assertTrue(searchComponents(components, "missing").isEmpty())
        assertTrue(searchComponents(emptyList(), "button").isEmpty())
    }
}
