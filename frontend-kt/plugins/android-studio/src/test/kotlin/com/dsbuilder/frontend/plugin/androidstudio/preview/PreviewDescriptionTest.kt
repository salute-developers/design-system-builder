package com.dsbuilder.frontend.plugin.androidstudio.preview

import com.dsbuilder.frontend.plugin.androidstudio.api.ApiJson
import kotlinx.serialization.json.JsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class PreviewDescriptionTest {
    private fun description(properties: String) = ApiJson.parseToJsonElement(
        """{"properties":[$properties]}""",
    ) as JsonObject

    @Test
    fun preservesStringBooleanAndNumericDefaultsForTheStory() {
        val result = previewExampleProps(
            description(
                """{"name":"label","type":"string","defaultValue":"Button"},
                  {"name":"enabled","type":"boolean","defaultValue":true},
                  {"name":"count","type":"int","defaultValue":2},
                  {"name":"icon","type":"singleChoice","defaultValue":"Start","variants":["Start","No"]}""",
            ),
        )
        assertEquals(
            ApiJson.parseToJsonElement("""{"label":"Button","enabled":true,"count":2,"icon":"Start"}"""),
            result,
        )
    }

    @Test
    fun refusesInvalidDefaultsAndDuplicateNames() {
        listOf(
            """{"name":"x","type":"boolean","defaultValue":"true"}""",
            """{"name":"x","type":"int","defaultValue":1.5}""",
            """{"name":"x","type":"singleChoice","defaultValue":"Other","variants":["Start"]}""",
            """{"name":"x","type":"string","defaultValue":"A"},{"name":"x","type":"string","defaultValue":"B"}""",
        ).forEach { properties ->
            assertFailsWith<IllegalStateException> { previewExampleProps(description(properties)) }
        }
    }
}
