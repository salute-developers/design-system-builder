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
    fun fillsOnlyDeclaredDefaultsAndPrefersCompletePublishedVariations() {
        val defaults = """"props":[{"name":"size"},{"name":"shape","defaultValue":"default"}],"""
        val short = """{"props":[{"name":"size","value":"l"}],"composeReference":"Badge.L"}"""
        val complete = """{"props":[{"name":"size","value":"l"},{"name":"shape","value":"default"}],
            "composeReference":"Badge.L.Default"}"""
        fun styles(variations: String) = payload("""{"styleName":"Badge",$defaults"variations":[$variations]}""")
        val selected = mapOf("size" to "l", "shape" to "default")
        assertEquals("Badge.L", componentStyleReference(styles(short), "Badge", selected))
        assertEquals("Badge.L.Default", componentStyleReference(styles("$short,$complete"), "Badge", selected))
        assertNull(componentStyleReference(styles(short), "Badge", selected + ("shape" to "pilled")))
        assertNull(componentStyleReference(styles(short), "Badge", selected + ("gap" to "wide")))
        assertNull(componentStyleReference(styles("$short,$short"), "Badge", selected))
        assertNull(componentStyleReference(styles("$complete,$complete"), "Badge", selected))
        val collision = payload(
            """{"styleName":"Badge","props":[{"name":"size"},{"name":"s-ize"},
              {"name":"shape","defaultValue":"default"}],"variations":[$short]}""",
        )
        assertNull(componentStyleReference(collision, "Badge", selected))
    }

    @Test
    fun refusesConflictingConstantsAndDoesNotIgnoreUnprovenAxes() {
        val styles = payload(style("BasicButton", "Button.M.Default"))
        val selected = mapOf("size" to "m", "view" to "default", "shape" to "round")
        assertNull(componentStyleReference(styles, "BasicButton", selected))
        assertEquals(
            "Button.M.Default",
            componentStyleReference(styles, "BasicButton", selected, mapOf("shape" to "round")),
        )
        assertNull(componentStyleReference(styles, "BasicButton", selected, mapOf("view" to "other")))
        assertNull(
            componentStyleReference(styles, "BasicButton", selected, mapOf("shape" to "round", "sh-ape" to "round")),
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
