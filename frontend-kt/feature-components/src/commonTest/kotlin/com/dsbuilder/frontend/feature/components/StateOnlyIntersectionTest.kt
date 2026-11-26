package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.feature.components.domain.codec.CommonConfig
import com.dsbuilder.frontend.feature.components.domain.codec.ConfigCodec
import com.dsbuilder.frontend.feature.components.domain.codec.ConfigCodecFailure
import com.dsbuilder.frontend.feature.components.domain.codec.ConfigCodecResult
import com.dsbuilder.frontend.feature.components.domain.codec.materializeStateOnly
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class StateOnlyIntersectionTest {
    @Test
    fun rejectsNativePropertyWithoutAnyBase() {
        val result = ConfigCodec().encodeFromText(
            """{"invariants":{"padding":{"type":"dimension","states":[{"state":["pressed"],"value":40}]}}}""",
        )
        assertTrue(result is ConfigCodecResult.Failure)
        assertEquals(ConfigCodecFailure.MissingStateBase("padding"), result.reason)
    }

    @Test
    fun preservesTypedBaseAndStatesOfSmallerIntersections() {
        val config = Json.decodeFromString<CommonConfig>(
            """{
              "colorSchemeVariationId":"view",
              "variations":[
                {"id":"size","name":"size","values":[{"name":"m","properties":{
                  "fill":{"type":"gradient","value":"gradient.base","alpha":0.5,"adjustment":2,
                    "states":[{"state":["focused"],"value":"gradient.focus"}]}}}]},
                {"id":"label","name":"label","values":[{"name":"inner",
                  "targets":[{"properties":[{"id":"size","value":"m"}]}],
                  "properties":{"fill":{"type":"color","states":[{"state":["hovered"],"value":"green"}]}}}]},
                {"id":"view","name":"view","values":[{"name":"default",
                  "targets":[{"properties":[{"id":"size","value":"m"},{"id":"label","value":"inner"}]}],
                  "properties":{"fill":{"type":"color","states":[{"state":["pressed"],"value":"blue"}]}}}]}
              ]
            }""",
        )
        val value = config.variations.last().values.single()
        val fill = config.materializeStateOnly("view", value).properties.getValue("fill")
        assertEquals("gradient", fill.type)
        assertEquals(JsonPrimitive("gradient.base"), fill.value)
        assertEquals(JsonPrimitive(0.5), fill.alpha)
        assertEquals(JsonPrimitive(2), fill.adjustment)
        assertEquals(listOf("focused", "hovered", "pressed"), fill.states!!.map { it.states.single() })
        assertEquals(listOf(null, "color", "color"), fill.states!!.map { it.type })
        assertEquals(null, value.properties.getValue("fill").value)
        val withBase = value.copy(
            properties = mapOf("fill" to value.properties.getValue("fill").copy(value = JsonPrimitive("solid.base"))),
        )
        val ownBase = config.materializeStateOnly("view", withBase).properties.getValue("fill")
        assertEquals(JsonPrimitive("solid.base"), ownBase.value)
        assertEquals(listOf("focused", "hovered", "pressed"), ownBase.states!!.map { it.states.single() })
        assertEquals("gradient", ownBase.states!!.first().type)
    }
}
