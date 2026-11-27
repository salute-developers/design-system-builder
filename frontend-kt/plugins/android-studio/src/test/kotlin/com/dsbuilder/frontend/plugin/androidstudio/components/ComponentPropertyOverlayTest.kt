package com.dsbuilder.frontend.plugin.androidstudio.components

import com.dsbuilder.frontend.plugin.androidstudio.api.ApiJson
import com.dsbuilder.frontend.plugin.androidstudio.preview.obj
import com.dsbuilder.frontend.plugin.androidstudio.preview.objects
import com.dsbuilder.frontend.plugin.androidstudio.preview.text
import kotlinx.serialization.json.JsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

class ComponentPropertyOverlayTest {
    private fun json(value: String) = ApiJson.parseToJsonElement(value) as JsonObject

    @Test
    fun stateOnlyCombinationInheritsBaseAndMergesUnorderedStateSets() {
        val base =
            json(
                """{"type":"dimension","value":24,"alpha":0.4,"adjustment":2,"states":[
            {"state":["pressed","hovered"],"value":25},{"state":["disabled"],"value":26}]}""",
            )
        val next =
            json(
                """{"type":"dimension","states":[
            {"state":["hovered","pressed"],"value":30},{"state":["focused"],"value":31}]}""",
            )
        val result = overlayComponentProperty(base, next)
        assertEquals("24", result.text("value"))
        assertEquals("0.4", result.text("alpha"))
        assertEquals("2", result.text("adjustment"))
        assertEquals(listOf("30", "26", "31"), result.objects("states").map { it.text("value") })
        assertEquals("25", base.objects("states").first().text("value"))
    }

    @Test
    fun baseOnlyOverrideClearsStatesAndOldAdjustmentsAndReplacesDefault() {
        val result = overlayComponentProperty(
            json(
                """{"type":"color","default":"old","alpha":0.4,"adjustment":2,
                "states":[{"state":["pressed"],"value":"pressed"}]}""",
            ),
            json("""{"type":"color","value":"new"}"""),
        )
        assertEquals("new", result.text("value"))
        for (key in listOf("default", "states", "alpha", "adjustment")) assertFalse(key in result)
    }

    @Test
    fun selectionInheritsInvariantBaseBeforeStateOnlyCombination() {
        val config = ComponentConfiguration(
            "Button",
            "button",
            json(
                """{
              "invariants":{"height":{"type":"dimension","value":24}},
              "variations":[{"id":"size","name":"size","values":[{"name":"m"},
                {"name":"m","targets":[{"properties":[]}],"properties":{
                  "height":{"type":"dimension","states":[{"state":["pressed"],"value":30}]}}}]}]
            }""",
            ),
        )
        val height = config.selectedProperties(mapOf("size" to "m")).obj("height")
        assertEquals("24", height.text("value"))
        assertEquals("30", height.objects("states").single().text("value"))
    }
}
