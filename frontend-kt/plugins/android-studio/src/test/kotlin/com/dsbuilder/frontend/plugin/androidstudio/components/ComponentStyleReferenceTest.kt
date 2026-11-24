package com.dsbuilder.frontend.plugin.androidstudio.components

import com.dsbuilder.frontend.plugin.androidstudio.api.ApiJson
import kotlinx.serialization.json.JsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ComponentStyleReferenceTest {
    private fun payload(
        styles: String,
    ): JsonObject = ApiJson.parseToJsonElement("""{"styles":[$styles]}""") as JsonObject
    private fun style(name: String, reference: String) = """
{
  "styleName": "$name",
  "variations": [
    {
      "props": [
        {
          "name": "size",
          "value": "M"
        },
        {
          "name": "view",
          "value": "Default"
        }
      ],
      "composeReference": "$reference"
    }
  ]
}
    """.trimIndent()

    @Test
    fun selectsTheConfigurationBeforeMatchingVariationRegardlessOfPairOrder() {
        val styles = payload(
            style(
                "BasicButton",
                "Button.M.Default",
            ) + "," + style(
                "OtherButton",
                "Other.M.Default",
            ),
        )
        assertEquals(
            "Other.M.Default",
            componentStyleReference(
                styles,
                "other-button",
                mapOf(
                    "view" to "default",
                    "size" to "m",
                ),
            ),
        )
        assertEquals(
            "Button.M.Default",
            componentStyleReference(
                styles,
                "basic-button",
                mapOf(
                    "size" to "m",
                    "view" to "default",
                ),
            ),
        )
    }

    @Test
    fun refusesAmbiguousAndIncompleteMatches() {
        val duplicate = payload(
            style(
                "BasicButton",
                "First",
            ) + "," + style(
                "basic-button",
                "Second",
            ),
        )
        assertNull(
            componentStyleReference(
                duplicate,
                "basic-button",
                mapOf(
                    "size" to "m",
                    "view" to "default",
                ),
            ),
        )
        assertNull(
            componentStyleReference(
                payload(style("BasicButton", "")),
                "BasicButton",
                mapOf("size" to "m", "view" to "default"),
            ),
        )
        val styles = payload(style("BasicButton", "First"))
        assertNull(componentStyleReference(styles, "basic-button", mapOf("size" to "m")))
        assertNull(
            componentStyleReference(
                styles,
                "missing",
                mapOf(
                    "size" to "m",
                    "view" to "default",
                ),
            ),
        )
        assertNull(
            componentStyleReference(
                styles,
                "basic-button",
                mapOf(
                    "size" to "m",
                    "s-ize" to "m",
                    "view" to "default",
                ),
            ),
        )
    }
}
