package com.dsbuilder.ds.components

import com.dsbuilder.ds.components.domain.ComponentConfig
import com.dsbuilder.ds.components.presentation.ComponentConfigResponse
import com.dsbuilder.ds.components.presentation.ImportComponentConfigRequest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ComponentConfigContractTest {
    private val json = Json { explicitNulls = true }

    @Test
    fun `single response keeps ids and empty states while export omits both`() {
        val config = ComponentConfig(
            null,
            null,
            mapOf(
                "background" to ComponentConfig.Property(
                    "property-id",
                    "color",
                    ComponentConfig.Scalar.Text("surface.default"),
                ),
            ),
            emptyList(),
            emptyList(),
        )

        val single = encoded(ComponentConfigResponse.single(config))
        val exported = encoded(ComponentConfigResponse.exported(config))
        val singleProperty = single["invariants"]!!.jsonObject["background"]!!.jsonObject
        val exportedProperty = exported["invariants"]!!.jsonObject["background"]!!.jsonObject

        assertEquals("property-id", singleProperty["id"]!!.jsonPrimitive.content)
        assertTrue("states" in singleProperty)
        assertTrue("default" in singleProperty)
        assertFalse("value" in singleProperty)
        assertFalse("id" in exportedProperty)
        assertFalse("states" in exportedProperty)
    }

    @Test
    fun `import request preserves arbitrary json property values`() {
        val request = json.decodeFromString<ImportComponentConfigRequest>(
            """
            {
              "designSystemId":"2df66b98-13b7-46d9-b611-43459e4f4367",
              "platform":"compose",
              "meta":{"name":"fixture"},
              "components":[{
                "componentName":"button",
                "styleName":"default",
                "config":{"invariants":{"shape":{"type":"value","value":{"nested":[1,true,null]}}}}
              }]
            }
            """.trimIndent(),
        )

        val value = request.toCommand(java.util.UUID.fromString(request.designSystemId))
            .components.single().config.invariants.getValue("shape").value
        assertTrue(value is ComponentConfig.Scalar.ObjectValue)
    }

    private fun encoded(value: ComponentConfigResponse): JsonObject =
        json.encodeToJsonElement(ComponentConfigResponse.serializer(), value).jsonObject
}
