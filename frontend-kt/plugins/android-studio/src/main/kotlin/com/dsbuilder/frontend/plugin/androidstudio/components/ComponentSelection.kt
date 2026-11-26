package com.dsbuilder.frontend.plugin.androidstudio.components

import com.dsbuilder.frontend.plugin.androidstudio.preview.obj
import com.dsbuilder.frontend.plugin.androidstudio.preview.objects
import com.dsbuilder.frontend.plugin.androidstudio.preview.text
import com.dsbuilder.frontend.plugin.androidstudio.preview.textOrNull
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

/** Оси и значения выгрузки: сочетания со списком targets не являются отдельными вариантами. */
internal fun ComponentConfiguration.axes(): List<JsonObject> = config.objects("variations")

internal fun axisValues(axis: JsonObject): List<JsonObject> =
    axis.objects("values").filter { (it["targets"] as? JsonArray).isNullOrEmpty() }

internal fun ComponentConfiguration.defaultSelections(): Map<
    String,
    String,
    > = axes().mapNotNull { axis ->
    val name = axis.text("name") ?: return@mapNotNull null
    val default = config.objects("defaults").singleOrNull {
        it.text("id") in listOf(name, axis.text("id"), axis.text("variationId"))
    }?.get("value")?.textOrNull()
    val value = axisValues(axis).singleOrNull { it.text("name") == default }?.text("name")
        ?: axisValues(axis).firstOrNull()?.text("name")
    value?.let { name to it }
}.toMap()

internal fun ComponentConfiguration.selectedProperties(
    selections: Map<
        String,
        String,
        >,
): JsonObject {
    val selected = linkedMapOf<String, JsonElement>()
    fun apply(values: JsonObject) {
        values.forEach { (name, value) ->
            val previous = selected[name] ?: config.obj("invariants")[name]
            selected[name] = overlayComponentProperty(previous as? JsonObject, value as JsonObject)
        }
    }
    val colorSchemeId = config.text("colorSchemeVariationId")
    val ordered = axes().sortedBy { axis ->
        if (colorSchemeId == null) {
            axis.text("name") == "view"
        } else {
            colorSchemeId in listOf(axis.text("id"), axis.text("name"), axis.text("variationId"))
        }
    }
    ordered.forEach { axis ->
        axisValues(axis).singleOrNull { it.text("name") == selections[axis.text("name")] }
            ?.obj("properties")?.let(::apply)
    }
    val combinations = axes().flatMap { axis ->
        axis.objects("values").filter { it.text("name") == selections[axis.text("name")] }.flatMap { value ->
            value.objects("targets").filter { target ->
                target.objects("properties").all { coordinate ->
                    val targetAxis = axes().singleOrNull {
                        coordinate.text("id") in listOf(
                            it.text("id"),
                            it.text("name"),
                            it.text("variationId"),
                        )
                    }
                    targetAxis != null && selections[targetAxis.text("name")] == coordinate["value"]?.textOrNull()
                }
            }.map { it.objects("properties").size to value.obj("properties") }
        }
    }
    combinations.sortedBy { it.first }.forEach { apply(it.second) }
    return JsonObject(selected)
}
