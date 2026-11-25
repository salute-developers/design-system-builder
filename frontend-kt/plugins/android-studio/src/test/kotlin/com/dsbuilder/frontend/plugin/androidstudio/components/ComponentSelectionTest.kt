package com.dsbuilder.frontend.plugin.androidstudio.components

import com.dsbuilder.frontend.plugin.androidstudio.api.ApiJson
import com.dsbuilder.frontend.plugin.androidstudio.preview.obj
import com.dsbuilder.frontend.plugin.androidstudio.preview.text
import kotlinx.serialization.json.JsonObject
import kotlin.test.Test
import kotlin.test.assertEquals

class ComponentSelectionTest {
    @Test
    fun givesColorSchemeLastPriorityThenAppliesMatchingCombinationAndInvariants() {
        val config = ApiJson.parseToJsonElement(
            """
{
  "invariants": {},
  "defaults": [
    {
      "id": "view",
      "value": "default"
    },
    {
      "id": "size",
      "value": "m"
    }
  ],
  "variations": [
    {
      "id": "view",
      "name": "view",
      "values": [
        {
          "name": "default",
          "properties": {
            "height": {
              "type": "dimension",
              "value": 30
            }
          }
        },
        {
          "name": "default",
          "targets": [
            {
              "properties": [
                {
                  "id": "size",
                  "value": "m"
                }
              ]
            }
          ],
          "properties": {
            "gap": {
              "type": "dimension",
              "value": 8
            }
          }
        }
      ]
    },
    {
      "id": "size",
      "name": "size",
      "values": [
        {
          "name": "m",
          "properties": {
            "height": {
              "type": "dimension",
              "value": 24
            },
            "gap": {
              "type": "dimension",
              "value": 4
            }
          }
        }
      ]
    }
  ]
}
""",
        ) as JsonObject
        val configuration = ComponentConfiguration("Button", "button", config)
        val selected = configuration.selectedProperties(configuration.defaultSelections())
        assertEquals("30", selected.obj("height").text("value"))
        assertEquals("8", selected.obj("gap").text("value"))
        assertEquals(mapOf("view" to "default", "size" to "m"), configuration.defaultSelections())
    }

    @Test
    fun explicitColorSchemeRoleUsesExportedAxisIdAfterRename() {
        val config = ApiJson.parseToJsonElement(
            """{
              "colorSchemeVariationId":"scheme",
              "defaults":[{"id":"scheme","value":"default"},{"id":"size","value":"m"}],
              "variations":[
                {"id":"scheme","variationId":"uuid-scheme","name":"scheme","values":[
                  {"name":"default","properties":{"height":{"type":"dimension","value":30}}}]},
                {"id":"size","variationId":"uuid-size","name":"size","values":[
                  {"name":"m","properties":{"height":{"type":"dimension","value":24}}}]}]
            }""",
        ) as JsonObject
        val configuration = ComponentConfiguration("Button", "button", config)
        assertEquals(
            "30",
            configuration.selectedProperties(configuration.defaultSelections()).obj("height").text("value"),
        )
    }
}
