package com.dsbuilder.documentation.publication.application

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonPrimitive

/** Строит явную серверную проекцию опубликованной привязки компонента. */
object CodeBindingProjection {
    /** Возвращает `null`, если платформенное содержимое не соответствует контракту компонента. */
    @Suppress("CyclomaticComplexMethod", "ReturnCount")
    fun project(
        binding: CodeBindingDto,
        detail: String,
        appearanceNames: Set<String>,
        variationNames: Set<String>,
    ): CodeBindingDto? {
        if (binding.kind != "component-style") return binding
        if (detail == "full" && appearanceNames.isEmpty() && variationNames.isEmpty()) return binding
        val payload = binding.platformPayload as? JsonObject ?: return null
        val styles = payload["styles"] as? JsonArray ?: return null
        val selected = styles.mapNotNull { it as? JsonObject }
            .takeIf { it.size == styles.size } ?: return null
        val appearances = selected.filter { style ->
            appearanceNames.isEmpty() || style["styleName"]?.jsonPrimitive?.content in appearanceNames
        }
        val projected = appearances.map { style -> projectStyle(style, detail, variationNames) ?: return null }
        val projectedPayload = JsonObject(
            when (detail) {
                "full" -> payload + ("styles" to JsonArray(projected))
                else -> mapOf(
                    "key" to (payload["key"] ?: return null),
                    "coreName" to (payload["coreName"] ?: return null),
                    "styles" to JsonArray(projected),
                    "totalVariationCount" to JsonPrimitive(
                        projected.sumOf {
                            (it["variationCount"] as? JsonPrimitive)?.content?.toIntOrNull() ?: 0
                        },
                    ),
                )
            },
        )
        return binding.copy(platformPayload = projectedPayload)
    }

    @Suppress("ReturnCount")
    private fun projectStyle(style: JsonObject, detail: String, variationNames: Set<String>): JsonObject? {
        val variations = style["variations"] as? JsonArray ?: return null
        val selected = variations.filter { variation ->
            variationNames.isEmpty() ||
                (variation as? JsonObject)?.get("name")?.jsonPrimitive?.content in variationNames
        }
        return when (detail) {
            "full" -> JsonObject(style + ("variations" to JsonArray(selected)))
            "summary", "variations" -> JsonObject(
                mapOf(
                    "key" to (style["key"] ?: return null),
                    "coreName" to (style["coreName"] ?: return null),
                    "styleName" to (style["styleName"] ?: return null),
                    "props" to (style["props"] ?: JsonArray(emptyList())),
                    "params" to ((style["styleApi"] as? JsonObject)?.get("params") ?: JsonArray(emptyList())),
                    "variationCount" to JsonPrimitive(if (detail == "summary") variations.size else selected.size),
                ) + if (detail == "variations") mapOf("variations" to JsonArray(selected)) else emptyMap(),
            )
            else -> null
        }
    }
}
