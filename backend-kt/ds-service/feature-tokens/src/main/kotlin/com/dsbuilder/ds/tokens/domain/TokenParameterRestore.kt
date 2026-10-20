package com.dsbuilder.ds.tokens.domain

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonPrimitive

/** Предметное восстановление параметров без записи клиентских значений и без потери платформенной сериализации. */
internal object TokenParameterRestore {
    private const val LENGTH = "(-?(?:[0-9]+(?:\\.[0-9]+)?|\\.[0-9]+)(?:rem|px)?)"
    private val shadow = Regex("^$LENGTH\\s+$LENGTH\\s+$LENGTH\\s+$LENGTH\\s+(.+)$")
    private val shadowFields = listOf("offsetX", "offsetY", "blur", "spread", "color")
    private val colorText = Regex(
        "^(?:#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|" +
            "\\[(?:general|additional)\\.[a-zA-Z0-9]+\\.[0-9]+\\](?:\\[[0-9]+(?:\\.[0-9]+)?\\])?)$",
    )

    /** Возвращает новое значение либо null, если путь не является отдельно отменяемым изменением. */
    fun restore(
        previous: JsonElement,
        current: JsonElement,
        paths: Set<String>,
        type: TokenType?,
    ): JsonElement? {
        val before = view(scalarValue(previous, type), type)
        val after = view(scalarValue(current, type), type)
        val allowed = differences(before, after, "/value")
        if (paths.isEmpty() || !allowed.containsAll(paths)) return null
        val restored = patch(before, after, "/value", paths) ?: return null
        val encoded = encodeRoot(current, restored, type)
        return if (type == TokenType.COLOR) normalizedColor(encoded) else encoded
    }

    private fun normalizedColor(value: JsonElement): JsonElement = when (value) {
        is JsonArray -> JsonArray(value.map(::normalizedColor))
        is JsonPrimitive -> {
            val decoded = if (value.isString && value.content.trimStart().startsWith('"')) {
                runCatching { Json.parseToJsonElement(value.content) }.getOrNull()
            } else {
                null
            }
            val text = (decoded as? JsonPrimitive)?.takeIf { it.isString }?.content
            if (text != null && colorText.matches(text)) {
                JsonPrimitive(text)
            } else {
                value
            }
        }
        else -> value
    }

    private fun isScalar(type: TokenType?): Boolean = type != TokenType.SHADOW && type != TokenType.GRADIENT

    private fun scalarValue(value: JsonElement, type: TokenType?): JsonElement {
        val node = decoded(value)
        return if (isScalar(type) && node is JsonArray && node.size == 1) node[0] else node
    }

    private fun encodeRoot(original: JsonElement, restored: JsonElement, type: TokenType?): JsonElement {
        val node = decoded(original)
        if (node != original) return JsonPrimitive(encodeRoot(node, restored, type).toString())
        return if (isScalar(type) && node is JsonArray && node.size == 1) {
            JsonArray(listOf(encodeLike(node[0], restored, type)))
        } else {
            encodeLike(original, restored, type)
        }
    }

    private fun decoded(value: JsonElement): JsonElement {
        val text = (value as? JsonPrimitive)?.takeIf { it.isString }?.content ?: return value
        if (!text.trimStart().startsWith("{") && !text.trimStart().startsWith("[")) return value
        return runCatching { Json.parseToJsonElement(text) }.getOrDefault(value)
    }

    private fun view(value: JsonElement, type: TokenType?): JsonElement = when (val node = decoded(value)) {
        is JsonObject -> JsonObject(node.mapValues { view(it.value, type) })
        is JsonArray -> JsonArray(node.map { view(it, type) })
        else -> {
            val match = if (type == TokenType.SHADOW && node is JsonPrimitive && node.isString) {
                shadow.matchEntire(node.content.trim())
            } else {
                null
            }
            match?.let { JsonObject(shadowFields.zip(it.groupValues.drop(1).map(::JsonPrimitive)).toMap()) } ?: node
        }
    }

    private fun encodeLike(original: JsonElement, restored: JsonElement, type: TokenType?): JsonElement {
        val decoded = decoded(original)
        return when {
            view(original, type) == restored -> original
            decoded != original -> JsonPrimitive(encodeLike(decoded, restored, type).toString())
            original is JsonArray && restored is JsonArray -> JsonArray(
                restored.mapIndexed { index, value ->
                    encodeLike(original.getOrNull(index) ?: value, value, type)
                },
            )
            original is JsonObject && restored is JsonObject ->
                JsonObject(restored.mapValues { (key, value) -> encodeLike(original[key] ?: value, value, type) })
            type == TokenType.SHADOW && isShadow(original) && restored is JsonObject ->
                JsonPrimitive(shadowFields.joinToString(" ") { restored.getValue(it).jsonPrimitive.content })
            else -> restored
        }
    }

    private fun isShadow(value: JsonElement): Boolean =
        value is JsonPrimitive && value.isString && shadow.matches(value.content.trim())

    private fun differences(previous: JsonElement?, current: JsonElement?, path: String): Set<String> = when {
        previous == current -> emptySet()
        path.count { it == '/' } > 16 -> setOf(path)
        previous is JsonObject && current is JsonObject ->
            (previous.keys + current.keys).flatMapTo(linkedSetOf()) { key ->
                differences(previous[key], current[key], child(path, key))
            }
        previous is JsonArray && current is JsonArray && !structureChanged(previous, current) ->
            current.indices.flatMapTo(linkedSetOf()) { index ->
                differences(previous[index], current[index], child(path, index.toString()))
            }
        else -> setOf(path)
    }

    private fun structureChanged(previous: JsonArray, current: JsonArray): Boolean =
        previous.size != current.size || previous.indices.any { index ->
            previous[index] != current[index] && current.indices.any { other ->
                other != index && previous[index] == current[other]
            }
        }

    private fun patch(
        previous: JsonElement?,
        current: JsonElement?,
        path: String,
        paths: Set<String>,
    ): JsonElement? = when {
        path in paths -> previous
        paths.none { it.startsWith("$path/") } -> current
        previous is JsonObject && current is JsonObject -> JsonObject(
            (previous.keys + current.keys).mapNotNull { key ->
                patch(previous[key], current[key], child(path, key), paths)?.let { key to it }
            }.toMap(),
        )
        previous is JsonArray && current is JsonArray -> JsonArray(
            current.indices.map { index ->
                checkNotNull(patch(previous[index], current[index], child(path, index.toString()), paths))
            },
        )
        else -> current
    }

    private fun child(path: String, key: String): String = "$path/${key.replace("~", "~0").replace("/", "~1")}"
}
