package com.dsbuilder.frontend.plugin.androidstudio.preview

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

internal data class ComponentPreviewDraft(val value: JsonObject)
internal data class AssemblyDiagnostic(val code: String, val path: String, val message: String)
internal sealed interface AssemblyResult {
    data class Success(val payload: JsonObject) : AssemblyResult
    data class Failed(val diagnostic: AssemblyDiagnostic) : AssemblyResult
}

internal class PreviewAssemblyException(
    val diagnostic: AssemblyDiagnostic,
) : IllegalArgumentException(diagnostic.message)
internal fun failAssembly(code: String, path: String, message: String): Nothing =
    throw PreviewAssemblyException(AssemblyDiagnostic(code, path, message))

/** Чистая сборка Preview Protocol v1 из черновика; не обращается к IDE или сети. */
internal object PayloadAssembler {
    fun assemble(draft: ComponentPreviewDraft): AssemblyResult = try {
        AssemblyResult.Success(assembleValue(draft.value))
    } catch (exception: PreviewAssemblyException) {
        if (draft.value["defaults"] != null) {
            assemble(ComponentPreviewDraft(JsonObject(draft.value - "defaults")))
        } else {
            AssemblyResult.Failed(exception.diagnostic)
        }
    }

    private fun assembleValue(draft: JsonObject): JsonObject {
        val properties = collectProperties(draft)
        val styles = collectStyles(draft, properties)
        val defaults = draft.obj("defaults")
        val tokens = PreviewTokenResolver(draft)
        val allProperties = properties.values + styles.values.flatMap { (it as JsonObject).obj("properties").values }
        allProperties.forEach { property ->
            sourcesOf(property as JsonObject).forEach(tokens::source)
        }
        val textDefaults = defaults.obj("text").mapValues { (_, id) ->
            try {
                tokens.resolve(id.textOrNull().orEmpty())
                id
            } catch (_: PreviewAssemblyException) {
                JsonNull
            }
        }.filterValues { it != JsonNull }
        val styleDefaults = defaults.obj("styles").filterValues { it.textOrNull() in styles }
        val resolvedDefaults = jsonObject(
            "text" to JsonObject(textDefaults).takeIf { it.isNotEmpty() },
            "styles" to JsonObject(styleDefaults).takeIf { it.isNotEmpty() },
        ).takeIf { it.isNotEmpty() }
        return jsonObject(
            "protocolVersion" to JsonPrimitive(1), "platform" to string("COMPOSE"),
            "assets" to JsonArray(tokens.assets.values.sortedBy { it.text("id") }),
            "theme" to JsonObject(tokens.theme),
            "component" to jsonObject(
                "id" to draft["componentId"],
                "variations" to (
                    draft["componentVariations"] ?: draft["variationSelections"]
                        ?: JsonObject(emptyMap())
                    ),
                "properties" to JsonObject(properties),
            ),
            "styles" to JsonObject(styles).takeIf { it.isNotEmpty() },
            "defaults" to resolvedDefaults,
            "example" to draft["example"], "surface" to draft["surface"],
        )
    }
    private fun collectProperties(draft: JsonObject): LinkedHashMap<String, JsonElement> {
        val properties = linkedMapOf<String, JsonElement>()
        val sources = mutableMapOf<String, String>()
        (draft.objects("selectedStyleProperties") + draft.objects("invariantProperties")).forEach { property ->
            val name = property.text("name").orEmpty()
            if (property.text("type") == "icon" && property.text("value").isNullOrBlank()) return@forEach
            if ((property["composeParameters"] as? JsonArray).isNullOrEmpty()) {
                if (property.text("hasNonComposeMappings") == "true") return@forEach
                failAssembly("missing_mapping", name, "Не задано сопоставление свойства Compose")
            }
            val effective = effectiveProperty(property)
            if (sources[name] != null && sources[name] != property.text("id") && properties[name] != effective) {
                failAssembly("property_conflict", name, "Конфликт значений свойства")
            }
            properties[name] = effective
            sources[name] = property.text("id").orEmpty()
        }
        return properties
    }

    private fun collectStyles(
        draft: JsonObject,
        properties: Map<
            String,
            JsonElement,
            >,
    ): LinkedHashMap<
        String,
        JsonElement,
        > {
        val styleIndex = draft.objects("styles").associateBy { it.text("id").orEmpty() }
        val styles = linkedMapOf<String, JsonElement>()
        fun visit(values: Collection<JsonElement>, trail: List<String>) {
            values.forEach { property ->
                sourcesOf(property as JsonObject).forEach { source ->
                    if (source.text("type") != "styleRef") return@forEach
                    val id = source.text("styleId").orEmpty()
                    if (id in trail) {
                        failAssembly(
                            "cycle",
                            id,
                            "Цикл ссылок стилей: ${(trail + id).joinToString(" → ")}",
                        )
                    }
                    if (id !in styles) {
                        val style = styleIndex[id] ?: failAssembly(
                            "invalid_reference",
                            id,
                            "Стиль не найден",
                        )
                        val nested = style.objects("properties").filterNot {
                            it.text("type") == "icon" && it.text("value").isNullOrBlank()
                        }.associate { it.text("name").orEmpty() to effectiveProperty(it) }
                        visit(nested.values, trail + id)
                        styles[id] = jsonObject(
                            "component" to style["componentId"],
                            "properties" to JsonObject(nested),
                        )
                    }
                }
            }
        }
        visit(properties.values, emptyList())
        val defaults = draft.obj("defaults")
        visit(
            defaults.obj("styles").values.map {
                jsonObject("base" to jsonObject("type" to string("styleRef"), "styleId" to it))
            },
            emptyList(),
        )
        return styles
    }
}

internal fun sourcesOf(property: JsonObject): List<JsonObject> =
    listOf(property.obj("base")) + property.objects("states").map { it.obj("source") }

private fun propertySource(
    property: JsonObject,
    raw: JsonElement?,
    alpha: JsonElement?,
): JsonObject {
    val path = property.text("id").orEmpty()
    if (raw == null || raw == JsonNull) {
        failAssembly(
            "incompatible_value",
            path,
            "Не задано значение свойства",
        )
    }
    val source = if (property["adjustment"] != null) {
        adjustedSource(
            property,
            raw,
        )
    } else {
        plainSource(
            property,
            raw,
        )
    }
    if (alpha == null || alpha == JsonNull) return source
    val opacity = alpha.textOrNull()?.toDoubleOrNull()
    if (opacity == null || !opacity.isFinite() || opacity !in 0.0..1.0) {
        failAssembly("incompatible_value", path, "Прозрачность должна быть от 0 до 1")
    }
    return JsonObject(source + ("alpha" to number(opacity)))
}

private fun plainSource(property: JsonObject, raw: JsonElement): JsonObject {
    val type = property.text("type")
    val numeric = raw.textOrNull()?.toDoubleOrNull()?.takeIf(Double::isFinite)
    return when {
        type in setOf("dimension", "float", "integer") && numeric != null ->
            jsonObject("type" to string("literal"), "value" to number(numeric))
        type in setOf("value", "icon") -> jsonObject("type" to string("literal"), "value" to raw)
        raw is JsonPrimitive && raw.isString && type !in setOf("float", "integer") ->
            jsonObject("type" to string("tokenRef"), "tokenId" to raw)
        else -> jsonObject("type" to string("literal"), "value" to raw)
    }
}

private fun adjustedSource(property: JsonObject, raw: JsonElement): JsonObject {
    val path = property.text("id").orEmpty()
    val adjustment = property["adjustment"]?.textOrNull()?.toDoubleOrNull()?.takeIf(Double::isFinite)
        ?: failAssembly("incompatible_value", path, "Поправка требует числового значения")
    if (property.text("type") == "shape" && raw is JsonPrimitive && raw.isString) {
        val token = if (adjustment == 0.0) raw.content else "${raw.content}@adjust(${number(adjustment).content})"
        return jsonObject("type" to string("tokenRef"), "tokenId" to string(token))
    }
    val numeric = raw.textOrNull()?.toDoubleOrNull()?.takeIf(Double::isFinite)
        ?: failAssembly("incompatible_value", path, "Поправка требует числового значения")
    return jsonObject("type" to string("literal"), "value" to number(numeric + adjustment))
}

internal fun effectiveProperty(property: JsonObject): JsonObject {
    property["styleRef"]?.let {
        return jsonObject(
            "base" to styleSource(it),
            "states" to JsonArray(
                property.objects("states").asReversed().mapNotNull { state ->
                    val reference = state["styleRef"] ?: return@mapNotNull null
                    val names = stateNames(state)
                    if (names.isEmpty()) return@mapNotNull null
                    jsonObject("when" to JsonArray(names.map(::string)), "source" to styleSource(reference))
                },
            ).takeIf { states -> states.isNotEmpty() },
        )
    }
    property["assetRef"]?.let {
        return jsonObject(
            "base" to jsonObject(
                "type" to string("assetRef"),
                "assetId" to it,
            ),
        )
    }
    val states = property.objects("states").asReversed().mapNotNull { state ->
        if (state["value"] == null || state["value"] == JsonNull) return@mapNotNull null
        val names = stateNames(state)
        if (names.isEmpty()) return@mapNotNull null
        jsonObject(
            "when" to JsonArray(names.map(::string)),
            "source" to propertySource(
                property,
                state["value"],
                state["alpha"],
            ),
        )
    }
    return jsonObject(
        "base" to propertySource(property, property["value"], property["alpha"]),
        "states" to JsonArray(states).takeIf { it.isNotEmpty() },
    )
}

internal fun number(value: Double): JsonPrimitive {
    if (!value.isFinite()) failAssembly("incompatible_value", "", "Некорректное число")
    return if (value >= Long.MIN_VALUE.toDouble() && value < Long.MAX_VALUE.toDouble() && value % 1 == 0.0) {
        JsonPrimitive(value.toLong())
    } else {
        JsonPrimitive(value)
    }
}

private fun styleSource(reference: JsonElement): JsonObject =
    jsonObject("type" to string("styleRef"), "styleId" to reference)

private fun stateNames(state: JsonObject): List<String> =
    (state["names"] as? JsonArray).orEmpty().mapNotNull { it.textOrNull() }.filter(String::isNotEmpty)
        .map { if (it == "hover") "hovered" else it }.distinct()
