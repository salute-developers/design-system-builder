package com.dsbuilder.ds.designsystems.domain

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.math.BigDecimal
import java.math.RoundingMode
import java.util.UUID

/** Число пользовательских строк: параметры значения разделяются, структурная правка остаётся одной. */
fun draftChangeDisplayCount(changes: List<DraftChange>, tokenTypes: Map<UUID, String?>): Int =
    changes.sumOf { change -> displayCount(change, tokenTypes) }

private fun displayCount(change: DraftChange, tokenTypes: Map<UUID, String?>): Int {
    val type = splitTokenType(change, tokenTypes) ?: return 1
    val before = canonical(editorValue(change.previousValue?.get("value"), type))
    val after = canonical(editorValue(change.currentValue?.get("value"), type))
    if (structureChanged(before, after)) return 1
    val previous = change.previousValue?.let { JsonObject(it + ("value" to (before ?: JsonNull))) }
    val current = change.currentValue?.let { JsonObject(it + ("value" to (after ?: JsonNull))) }
    val paths = changedFieldPaths(change.changedPaths, previous, current)
    return if (paths.isEmpty() || paths.any { it.firstOrNull() != "value" }) 1 else paths.size
}

private fun splitTokenType(change: DraftChange, tokenTypes: Map<UUID, String?>): String? {
    if (change.entityType != "token-value" || change.operation != ChangeOperation.UPDATED) return null
    val state = change.currentValue ?: change.previousValue
    val tokenId = state?.get("token_id") ?: state?.get("tokenId")
    return tokenId?.let { runCatching { tokenTypes[UUID.fromString((it as? JsonPrimitive)?.content)] }.getOrNull() }
}

private fun changedFieldPaths(paths: Set<String>, previous: JsonObject?, current: JsonObject?): List<List<String>> =
    paths.ifEmpty { (previous?.keys.orEmpty() + current?.keys.orEmpty()).toSet() }
        .flatMap { path ->
            val segments = if (path.startsWith('/')) {
                path.drop(1).split('/').map { it.replace("~1", "/").replace("~0", "~") }
            } else {
                path.split('.')
            }
            changedLeaves(segments, at(previous, segments), at(current, segments))
        }

private val hiddenNames = setOf(
    "id", "uid", "editrevision", "revision", "versionid", "designsystemid", "tenantid", "tokenid",
    "componentid", "appearanceid", "configurationid", "styleid", "propertyid", "variationid",
    "createdat", "updatedat", "deletedat", "actorid", "changedat", "platform", "mode", "paletteid",
)
private val visibleReferences = setOf("defaultstyleid", "statesetids", "groupid", "parentid")

private fun hidden(name: String): Boolean {
    val key = name.replace("-", "").replace("_", "").lowercase()
    return key !in visibleReferences && (key in hiddenNames || Regex("(?:_id|Id|_ids|Ids)$").containsMatchIn(name))
}

private fun decoded(value: JsonElement?): JsonElement? {
    val text = (value as? JsonPrimitive)?.takeIf { it.isString }?.content ?: return value
    return if (text.trimStart().startsWith('[') || text.trimStart().startsWith('{')) {
        runCatching { Json.parseToJsonElement(text) }.getOrDefault(value)
    } else {
        value
    }
}

private fun members(value: JsonElement?): Map<String, JsonElement>? = when (value) {
    is JsonObject -> value
    is JsonArray -> value.mapIndexed { index, element -> index.toString() to element }.toMap()
    else -> null
}

private fun canonical(value: JsonElement?): JsonElement? = when (value) {
    is JsonObject -> JsonObject(value.mapValues { canonical(it.value) ?: JsonNull })
    is JsonArray -> JsonArray(value.map { canonical(it) ?: JsonNull })
    is JsonPrimitive -> if (value.isString) {
        value
    } else {
        val number = value.content.toDoubleOrNull()
        if (number != null && number.isFinite() && number == number.toLong().toDouble()) {
            JsonPrimitive(
                number.toLong(),
            )
        } else {
            value
        }
    }
    else -> value
}

private fun at(value: JsonElement?, segments: List<String>): JsonElement? =
    segments.fold(value) { node, segment -> members(decoded(node))?.get(segment) }

private fun changedLeaves(path: List<String>, before: JsonElement?, after: JsonElement?): List<List<String>> {
    if (path.any(::hidden)) return emptyList()
    val previous = decoded(before)
    val current = decoded(after)
    if (previous == current) return emptyList()
    val left = members(previous)
    val right = members(current)
    return if (left != null || right != null) {
        (left?.keys.orEmpty() + right?.keys.orEmpty()).flatMap {
            changedLeaves(
                path + it,
                left?.get(it),
                right?.get(it),
            )
        }
    } else {
        listOf(path)
    }
}

private fun structureChanged(before: JsonElement?, after: JsonElement?): Boolean {
    if (before is JsonArray || after is JsonArray) return arrayStructureChanged(before, after)
    val left = members(before)
    val right = members(after)
    if ((left == null) != (right == null)) return true
    return left != null && right != null &&
        (left.keys + right.keys).any { structureChanged(left[it], right[it]) }
}

private fun arrayStructureChanged(before: JsonElement?, after: JsonElement?): Boolean {
    if (before !is JsonArray || after !is JsonArray || before.size != after.size) return true
    return before.indices.any { index ->
        (before[index] != after[index] && after.indices.any { it != index && before[index] == after[it] }) ||
            structureChanged(before[index], after[index])
    }
}

private fun length(value: JsonElement?): JsonElement? {
    val text = (value as? JsonPrimitive)?.takeIf { it.isString }?.content ?: return value
    val match = Regex("^(-?\\d+(?:\\.\\d+)?)(rem|px)?$").matchEntire(text) ?: return value
    val number = match.groupValues[1].toDouble() * if (match.groupValues[2] == "rem") 16 else 1
    return editorNumber(number)
}

private fun editorValue(raw: JsonElement?, type: String): JsonElement? {
    val value = decoded(raw)
    if (type !in setOf("shadow", "gradient") && value is JsonArray && value.size == 1) {
        return editorValue(
            value[0],
            type,
        )
    }
    return when (type) {
        "shape", "spacing" -> length(value)
        "typography" -> typography(value)
        "shadow" -> if (value is JsonArray) JsonArray(value.map(::shadow)) else value?.let(::shadow)
        else -> value
    }
}

private fun typography(value: JsonElement?): JsonElement? = (value as? JsonObject)?.let {
    JsonObject(
        it.mapValues { (key, parameter) ->
            when (key) {
                "fontSize", "lineHeight" -> length(parameter) ?: JsonNull
                "letterSpacing" -> letterSpacing(parameter)
                else -> parameter
            }
        },
    )
} ?: value

private fun letterSpacing(value: JsonElement): JsonElement {
    val text = (value as? JsonPrimitive)?.contentOrNull ?: return value
    return when {
        text == "normal" -> JsonPrimitive(0)
        !Regex("^-?\\d+(?:\\.\\d+)?em$").matches(text) -> value
        else -> editorNumber(text.removeSuffix("em").toDouble() * 16)
    }
}

private fun editorNumber(value: Double): JsonElement = if (value.isFinite()) {
    JsonPrimitive(BigDecimal(value).setScale(4, RoundingMode.HALF_UP).toDouble())
} else {
    JsonNull
}

private fun shadow(value: JsonElement): JsonElement {
    val text = (value as? JsonPrimitive)?.takeIf { it.isString }?.content ?: return value
    val parts = Regex("^(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+(.+)$").matchEntire(text.trim()) ?: return value
    val names = listOf("offsetX", "offsetY", "blur", "spread", "color")
    return JsonObject(
        names.mapIndexed { index, name ->
            val parameter = JsonPrimitive(parts.groupValues[index + 1])
            name to (if (index < 4) length(parameter) ?: parameter else parameter)
        }.toMap(),
    )
}
