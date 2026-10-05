package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject

internal val propertyTypes = setOf(
    "color", "typography", "shape", "shadow", "dimension", "float", "component_style", "value", "icon",
    "boolean", "integer",
)
internal val componentPlatforms = setOf("web", "compose", "ios")
internal val propertyPlatforms = setOf("xml", "compose", "ios", "web")

internal fun String.validName(): Boolean = trim().let { it.isNotEmpty() && it.length <= 255 }
internal fun String?.validDescription(): Boolean = this == null || trim().length <= 1000
internal fun JsonObject.hasInvalidNull(vararg fields: String): Boolean =
    fields.any { it in this && this[it] is JsonNull }
