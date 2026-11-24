package com.dsbuilder.ds.components

import com.dsbuilder.ds.components.domain.StateNames
import com.dsbuilder.ds.components.domain.StateSetRule
import com.dsbuilder.ds.components.domain.StateSetRule.Verdict
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/** Правило разрешения имени состояния и правило допустимого набора (change add-property-state-support). */
class PropertyStateRulesTest {
    private val textField = UUID.randomUUID()
    private val radioBox = UUID.randomUUID()

    private fun common(name: String) = StateNames.Scoped(null, name)
    private fun own(name: String, component: UUID = textField) = StateNames.Scoped(component, name)

    @Test
    fun `common state wins over a shadow of the component`() {
        val states = listOf(own("disabled"), common("disabled"), own("checked", radioBox))

        assertEquals(common("disabled"), StateNames.resolve("Disabled", textField, states) { it })
        assertNull(StateNames.resolve("checked", textField, states) { it })
        assertEquals(own("checked", radioBox), StateNames.resolve("checked", radioBox, states) { it })
    }

    @Test
    fun `visible states hide shadows and other components`() {
        val states =
            listOf(common("hovered"), own("disabled"), common("disabled"), own("collapsed"), own("x", radioBox))

        assertEquals(
            listOf(common("hovered"), common("disabled"), own("collapsed")),
            StateNames.visible(textField, states) { it },
        )
    }

    @Test
    fun `empty set is always allowed`() {
        assertEquals(Verdict.ALLOWED, StateSetRule.check(textField, emptyList(), false, emptyList()))
    }

    @Test
    fun `undeclared support allows common and own states only`() {
        assertEquals(Verdict.ALLOWED, StateSetRule.check(textField, null, false, listOf(common("hovered"), own("x"))))
        assertEquals(Verdict.FOREIGN_STATE, StateSetRule.check(textField, null, true, listOf(own("checked", radioBox))))
    }

    @Test
    fun `state outside the list is not supported`() {
        val list = listOf("focused", "pressed", "hovered", "activated", "selected").map(::common)

        assertEquals(Verdict.NOT_SUPPORTED, StateSetRule.check(textField, list, true, listOf(common("disabled"))))
        assertEquals(Verdict.NOT_SUPPORTED, StateSetRule.check(textField, emptyList(), true, listOf(common("hovered"))))
    }

    @Test
    fun `combination requires the flag`() {
        val list = listOf(common("pressed"), common("hovered"))

        assertEquals(Verdict.ALLOWED, StateSetRule.check(textField, list, false, listOf(common("hovered"))))
        assertEquals(
            Verdict.NOT_SUPPORTED,
            StateSetRule.check(textField, list, false, listOf(common("pressed"), common("hovered"))),
        )
        assertEquals(
            Verdict.ALLOWED,
            StateSetRule.check(textField, list, true, listOf(common("pressed"), common("hovered"))),
        )
    }

    @Test
    fun `value in a shadow of a common state stays allowed`() {
        assertEquals(
            Verdict.ALLOWED,
            StateSetRule.check(textField, listOf(common("disabled")), false, listOf(own("disabled"))),
        )
    }
}
