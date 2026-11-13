package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.ImportApiMeta
import com.dsbuilder.ds.components.domain.AliasDeprecation
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Полное каноническое описание релиза; порядок входных списков не меняет его идентичность. */
internal fun coreMetaProjection(command: ImportApiMeta): String = JsonArray(
    command.components.groupBy { it.name }.toSortedMap().map { (name, components) ->
        buildJsonObject {
            put("name", name)
            put("description", components.first().description?.let(::JsonPrimitive) ?: JsonNull)
            put("states", JsonArray(components.flatMap { it.states }.distinct().sorted().map(::JsonPrimitive)))
            put(
                "dependencies",
                JsonArray(
                    components.first().dependencies.distinct().sortedBy { it.component }.map {
                        buildJsonObject {
                            put("component", it.component)
                            put("type", it.type)
                            put("order", it.order?.let(::JsonPrimitive) ?: JsonNull)
                        }
                    },
                ),
            )
            put(
                "properties",
                JsonArray(
                    components.flatMap { it.properties }.groupBy { it.name }.toSortedMap().map {
                            (_, properties) ->
                        propertyProjection(properties)
                    },
                ),
            )
        }
    },
).toString()

private fun propertyProjection(properties: List<ImportApiMeta.Property>) = buildJsonObject {
    val property = properties.first()
    put("name", property.name)
    put("type", property.type)
    put("description", property.description?.let(::JsonPrimitive) ?: JsonNull)
    put("defaultValue", property.defaultValue?.let(::JsonPrimitive) ?: JsonNull)
    put("componentTargets", JsonArray(property.componentTargets.distinct().sorted().map(::JsonPrimitive)))
    put(
        "aliases",
        JsonArray(
            properties.flatMap { it.aliases }.distinct().sortedBy { it.name }.map { alias ->
                buildJsonObject {
                    put("name", alias.name)
                    put(
                        "deprecation",
                        when (alias.deprecation) {
                            AliasDeprecation.Unknown -> "unknown"
                            AliasDeprecation.Current -> "current"
                            is AliasDeprecation.Deprecated -> "deprecated"
                        },
                    )
                    put(
                        "message",
                        (alias.deprecation as? AliasDeprecation.Deprecated)?.message?.let(::JsonPrimitive) ?: JsonNull,
                    )
                }
            },
        ),
    )
}
