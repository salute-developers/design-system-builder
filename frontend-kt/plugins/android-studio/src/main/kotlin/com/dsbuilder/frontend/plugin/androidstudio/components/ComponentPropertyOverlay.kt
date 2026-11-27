package com.dsbuilder.frontend.plugin.androidstudio.components

import com.dsbuilder.frontend.plugin.androidstudio.preview.objects
import com.dsbuilder.frontend.plugin.androidstudio.preview.textOrNull
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject

/** Как Prop.overlay клиента: база и наборы состояний наследуются независимо. */
internal fun overlayComponentProperty(previous: JsonObject?, next: JsonObject): JsonObject {
    val baseKeys = setOf("default", "value", "alpha", "adjustment")
    val hasBase = listOf("default", "value").any { next[it] != null && next[it] != JsonNull }
    val result = (previous.orEmpty() + next.filterKeys { it !in baseKeys && it != "states" }).toMutableMap()
    if (hasBase) {
        baseKeys.forEach(result::remove)
        baseKeys.forEach { key -> next[key]?.takeUnless { it == JsonNull }?.let { result[key] = it } }
    }
    val states = next.objects("states")
    if (hasBase && states.isEmpty()) {
        result.remove("states")
    } else {
        val merged = (previous?.objects("states").orEmpty() + states).associateBy { state ->
            (state["state"] as? JsonArray).orEmpty().map { it.textOrNull().orEmpty() }.sorted()
        }
        if (merged.isNotEmpty()) result["states"] = JsonArray(merged.values.toList())
    }
    return JsonObject(result)
}
