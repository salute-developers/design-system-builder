package com.dsbuilder.frontend.feature.components.domain.apimeta

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject

/** Отличает явно пустой состав релиза от файла без распознанных компонентов. */
internal fun isExplicitlyEmptyApiMeta(text: String, platform: String): Boolean {
    val source = try {
        Json.parseToJsonElement(text)
    } catch (_: IllegalArgumentException) {
        return false
    }
    val components = when (source) {
        is JsonArray -> source
        is JsonObject -> if (platform == "xml") source["components"] as? JsonArray else null
        else -> null
    }
    return components?.isEmpty() == true
}
