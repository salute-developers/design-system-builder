package com.dsbuilder.frontend.plugin.androidstudio.preview

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

internal fun JsonObject.text(key: String): String? = (get(key) as? JsonPrimitive)?.contentOrNull
internal fun JsonObject.objects(key: String): List<JsonObject> =
    (get(key) as? JsonArray).orEmpty().map { it as JsonObject }
internal fun JsonObject.obj(key: String): JsonObject = get(key) as? JsonObject ?: JsonObject(emptyMap())
internal fun JsonElement.textOrNull(): String? = (this as? JsonPrimitive)?.contentOrNull
internal fun jsonObject(vararg entries: Pair<String, JsonElement?>): JsonObject =
    JsonObject(entries.filter { it.second != null && it.second != JsonNull }.associate { it.first to it.second!! })
internal fun string(value: String): JsonPrimitive = JsonPrimitive(value)
