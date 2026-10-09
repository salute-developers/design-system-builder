package com.dsbuilder.ds.app

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertTrue

class SeedResourcesContractTest {
    @Test
    fun `every initial value references an owned token definition`() {
        val definitions = resource("/token-definitions.json").jsonArray
        val initialValues = resource("/token-initial-values.json").jsonObject.getValue("values").jsonArray
        val tokenNames = definitions.mapTo(mutableSetOf()) { definition ->
            definition.jsonObject.getValue("name").jsonPrimitive.content
        }
        val missingNames = initialValues.map { definition ->
            definition.jsonObject.getValue("name").jsonPrimitive.content
        }.filterNot(tokenNames::contains).toSet()

        assertTrue(missingNames.isEmpty(), "Initial values reference missing tokens: $missingNames")
    }

    @Test
    fun `every component value references an owned token definition`() {
        val definitions = resource("/token-definitions.json").jsonArray
        val componentSeeds = resource("/component-seeds.json")
        val tokenNames = definitions.mapTo(mutableSetOf()) { definition ->
            definition.jsonObject.getValue("name").jsonPrimitive.content
        }
        val referenced = mutableSetOf<String>()
        collectTokens(componentSeeds, referenced)

        assertTrue(
            referenced.all(tokenNames::contains),
            "Component values reference missing tokens: ${referenced.filterNot(tokenNames::contains)}",
        )
    }

    private fun collectTokens(value: JsonElement, target: MutableSet<String>) {
        when (value) {
            is JsonArray -> value.forEach { collectTokens(it, target) }
            is JsonObject -> {
                value["token"]?.jsonPrimitive?.content?.let(target::add)
                value.values.forEach { collectTokens(it, target) }
            }
            else -> Unit
        }
    }

    private fun resource(path: String) = requireNotNull(javaClass.getResourceAsStream(path))
        .bufferedReader()
        .use { Json.parseToJsonElement(it.readText()) }
}
