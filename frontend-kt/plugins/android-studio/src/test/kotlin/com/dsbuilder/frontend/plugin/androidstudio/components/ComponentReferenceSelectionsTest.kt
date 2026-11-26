package com.dsbuilder.frontend.plugin.androidstudio.components

import com.dsbuilder.frontend.plugin.androidstudio.api.ApiJson
import com.dsbuilder.frontend.plugin.androidstudio.preview.PreviewAssemblyException
import kotlinx.serialization.json.JsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class ComponentReferenceSelectionsTest {
    private fun configuration() = ComponentConfiguration(
        "Group",
        "group",
        ApiJson.parseToJsonElement(
            """{
              "defaults":[{"id":"size","value":"s"},{"id":"gap","value":"spaced"},
                {"id":"shape","value":"round"}],
              "variations":[
                {"id":"size","name":"size","values":[{"name":"s"},{"name":"l"}]},
                {"id":"gap","variationId":"gap-uuid","name":"gap","values":[
                  {"name":"spaced"},{"name":"none","authoredId":"no-gap"}]},
                {"id":"shape","name":"shape","values":[{"name":"round"},{"name":"default"},
                  {"name":"default","authoredId":"x.y","targets":[{"properties":[
                    {"id":"size","value":"l"},{"id":"gap-uuid","value":"none"}]}]}]}]
            }""",
        ) as JsonObject,
    )

    @Test
    fun resolvesAuthoredValueAndMixedNamesWithoutDefaultSubstitution() {
        val config = configuration()
        assertEquals(
            mapOf("size" to "s", "gap" to "none", "shape" to "round"),
            referenceSelections(config, listOf("no-gap")),
        )
        assertEquals(
            mapOf("size" to "s", "gap" to "none", "shape" to "default"),
            referenceSelections(config, listOf("no-gap", "default")),
        )
        assertEquals(
            mapOf("size" to "l", "gap" to "none", "shape" to "default"),
            referenceSelections(config, listOf("l", "none", "default")),
        )
    }

    @Test
    fun resolvesCombinationAuthoredIdSpanningSeveralSegments() {
        assertEquals(
            mapOf("size" to "l", "gap" to "none", "shape" to "default"),
            referenceSelections(configuration(), listOf("x", "y")),
        )
    }

    @Test
    fun rejectsUncoveredAndConflictingTailsAndMatchesAuthoredIdsExactly() {
        for (tail in listOf(
            listOf("l", "missing"),
            listOf(""),
            listOf("No-Gap"),
            listOf(" no-gap"),
            listOf("none", "spaced"),
        )) {
            assertFailsWith<PreviewAssemblyException> { referenceSelections(configuration(), tail) }
        }
        assertEquals(configuration().defaultSelections(), referenceSelections(configuration(), emptyList()))
    }

    @Test
    fun ordinaryValueWinsOverCombinationWithTheSameAuthoredId() {
        val config = configuration()
        val text = config.config.toString().replace("\"authoredId\":\"no-gap\"", "\"authoredId\":\"x.y\"")
        val changed = config.copy(config = ApiJson.parseToJsonElement(text) as JsonObject)
        assertEquals(
            mapOf("size" to "s", "gap" to "none", "shape" to "round"),
            referenceSelections(changed, listOf("x", "y")),
        )
    }
}
