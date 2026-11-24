package com.dsbuilder.frontend.plugin.androidstudio.preview

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.util.Locale

/** Замыкание токенов темы и ресурсов, достижимых из свойств превью. */
internal class PreviewTokenResolver(private val draft: JsonObject) {
    val theme = linkedMapOf<String, JsonElement>()
    val assets = linkedMapOf<String, JsonObject>()
    private val availableAssets = draft.objects("assets")
    private val tokens = draft.objects("themeTokens")
    private val path = mutableListOf<String>()

    init {
        availableAssets.filter { it.text("type") == "SVG" && it.text("id").orEmpty().startsWith("icon:") }
            .forEach { assets[it.text("id").orEmpty()] = it }
    }

    fun source(source: JsonObject) {
        when (source.text("type")) {
            "tokenRef" -> resolve(source.text("tokenId").orEmpty())
            "assetRef" -> {
                val id = source.text("assetId").orEmpty()
                assets[id] = availableAssets.singleOrNull { it.text("id") == id }
                    ?: failAssembly("missing_asset", id, "Ресурс не найден")
            }
        }
    }

    fun resolve(id: String) {
        if (id in theme) return
        val adjusted = Regex("^(.+)@adjust\\((-?\\d+(?:\\.\\d+)?)\\)$").matchEntire(id)
        if (adjusted != null) {
            val baseId = adjusted.groupValues[1]
            resolve(baseId)
            val base = theme[baseId] as JsonObject
            if (base.text("type") != "shape") {
                failAssembly(
                    "incompatible_value",
                    id,
                    "Поправка требует токен формы",
                )
            }
            val delta = adjusted.groupValues[2].toDouble()
            theme[id] = jsonObject(
                "type" to string("shape"),
                "cornerRadii" to JsonArray(
                    (base["cornerRadii"] as JsonArray).map { number((numeric(it) + delta).coerceAtLeast(0.0)) },
                ),
            )
            return
        }
        if (id in path) {
            failAssembly(
                "cycle",
                id,
                "Цикл токенов: ${(path + id).joinToString(" → ")}",
            )
        }
        val candidates = listOfNotNull(
            id,
            "${draft.text("themeMode")}.$id",
            "screen-s.$id",
            id.takeIf { it.startsWith("fontFamily.") }?.removePrefix("fontFamily."),
        )
        val token = candidates.firstNotNullOfOrNull { candidate -> tokens.singleOrNull { it.text("id") == candidate } }
            ?: candidates.firstNotNullOfOrNull { candidate ->
                tokens.singleOrNull { loose(it.text("id").orEmpty()) == loose(candidate) }
            }
            ?: failAssembly("missing_token", id, "Токен не найден")
        if (token.text("enabled") == "false") failAssembly("disabled_token", id, "Токен отключён")
        val raw = token.obj("values")["android"] ?: failAssembly(
            "missing_token",
            id,
            "Нет значения Android",
        )
        path.add(id)
        try {
            theme[id] = normalize(token, raw)
        } finally {
            path.removeAt(path.lastIndex)
        }
    }

    private fun normalize(token: JsonObject, raw: JsonElement): JsonObject {
        val id = token.text("id").orEmpty()
        val type = token.text("type").orEmpty()
        val obj = raw as? JsonObject ?: JsonObject(emptyMap())
        return when (type) {
            "color" -> jsonObject("type" to string(type), "value" to string(color(raw, id)))
            "dimension" -> jsonObject(
                "type" to string(type),
                "value" to number(numeric(obj["value"] ?: raw)),
            )
            "shape" -> {
                val radius = number(numeric(obj["cornerRadius"] ?: obj["value"] ?: raw))
                jsonObject("type" to string(type), "cornerRadii" to JsonArray(List(4) { radius }))
            }
            "typography" -> typography(obj, id)
            "fontFamily" -> font(token, obj)
            "shadow" -> shadow(raw, id)
            "gradient" -> gradient(raw, id)
            else -> failAssembly("incompatible_value", id, "Неподдерживаемый тип токена: $type")
        }
    }

    private fun typography(obj: JsonObject, id: String): JsonObject {
        val family = obj.text("fontFamilyRef") ?: obj.text("fontFamilyTokenId")
            ?: failAssembly("invalid_reference", id, "Не задано семейство шрифта")
        resolve(family)
        return jsonObject(
            "type" to string("typography"),
            "fontFamilyTokenId" to string(family),
            "fontSize" to number(numeric(obj["fontSize"] ?: obj["textSize"] ?: obj["size"])),
            "lineHeight" to number(numeric(obj["lineHeight"])),
            "letterSpacing" to number(numeric(obj["letterSpacing"] ?: obj["kerning"] ?: JsonPrimitive(0))),
            "weight" to number(numeric(obj["fontWeight"] ?: obj["weight"])),
        )
    }

    private fun font(token: JsonObject, raw: JsonObject): JsonObject {
        val id = token.text("id").orEmpty()
        val faces = raw.objects("fonts").mapIndexed { index, font ->
            val url = font.text("link") ?: (font["src"] as? JsonArray)?.firstOrNull()?.textOrNull()
                ?: failAssembly("missing_asset", id, "Нет адреса файла шрифта")
            val type = when {
                Regex("\\.otf(?:$|[?#])", RegexOption.IGNORE_CASE).containsMatchIn(url) -> "OTF"
                Regex("\\.ttf(?:$|[?#])", RegexOption.IGNORE_CASE).containsMatchIn(url) -> "TTF"
                else -> failAssembly("missing_asset", id, "Неподдерживаемый файл шрифта")
            }
            val asset = availableAssets.firstOrNull { it.text("url") == url }
                ?: jsonObject(
                    "id" to string("$id:$index"),
                    "type" to string(type),
                    "url" to string(url),
                )
            assets[asset.text("id").orEmpty()] = asset
            val italic = (font.text("fontStyle") ?: font.text("style")).equals(
                "italic",
                ignoreCase = true,
            )
            jsonObject(
                "assetId" to asset["id"],
                "weight" to number(numeric(font["fontWeight"] ?: font["weight"])),
                "style" to string(if (italic) "ITALIC" else "NORMAL"),
            )
        }
        return jsonObject(
            "type" to string("fontFamily"),
            "faces" to JsonArray(faces),
            "allowFallback" to JsonPrimitive(true),
        )
    }

    private fun shadow(raw: JsonElement, id: String): JsonObject {
        val layers = (raw as? JsonArray)?.map { value ->
            val layer = value as? JsonObject ?: failAssembly(
                "incompatible_value",
                id,
                "Некорректный слой тени",
            )
            jsonObject(
                "x" to number(numeric(layer["offsetX"] ?: layer["x"] ?: JsonPrimitive(0))),
                "y" to number(numeric(layer["offsetY"] ?: layer["y"] ?: JsonPrimitive(0))),
                "blur" to number(numeric(layer["blurRadius"] ?: layer["blur"] ?: JsonPrimitive(0))),
                "spread" to number(numeric(layer["spreadRadius"] ?: layer["spread"] ?: JsonPrimitive(0))),
                "color" to string(color(layer["color"], id)),
            )
        } ?: failAssembly("incompatible_value", id, "Некорректная тень")
        if (layers.isEmpty()) failAssembly("incompatible_value", id, "Пустая тень")
        return jsonObject("type" to string("shadow"), "layers" to JsonArray(layers))
    }

    private fun gradient(raw: JsonElement, id: String): JsonObject {
        val solid = if (raw is JsonArray && raw.size == 1) raw[0] else raw
        val source = if (solid is JsonPrimitive && solid.isString) {
            JsonArray(listOf(jsonObject("kind" to string("color"), "background" to solid)))
        } else {
            raw
        }
        val layers = (source as? JsonArray)?.map { value ->
            val layer = value as? JsonObject ?: failAssembly(
                "incompatible_value",
                id,
                "Некорректный слой градиента",
            )
            when (layer.text("kind")) {
                "color" -> {
                    val color = color(layer["background"], id)
                    jsonObject(
                        "kind" to string("linear"), "angle" to JsonPrimitive(0),
                        "stops" to JsonArray(
                            listOf(
                                jsonObject(
                                    "color" to string(color),
                                    "position" to JsonPrimitive(0),
                                ),
                                jsonObject(
                                    "color" to string(color),
                                    "position" to JsonPrimitive(1),
                                ),
                            ),
                        ),
                    )
                }
                "linear" -> linearGradient(layer, id)
                else -> failAssembly(
                    "incompatible_value",
                    id,
                    "Протокол не поддерживает этот градиент",
                )
            }
        } ?: failAssembly("incompatible_value", id, "Некорректный градиент")
        if (layers.isEmpty()) failAssembly("incompatible_value", id, "Пустой градиент")
        return jsonObject("type" to string("gradient"), "layers" to JsonArray(layers))
    }

    private fun linearGradient(layer: JsonObject, id: String): JsonObject {
        val colors = layer["colors"] as? JsonArray ?: failAssembly(
            "incompatible_value",
            id,
            "Нет цветов",
        )
        val locations = layer["locations"] as? JsonArray ?: failAssembly(
            "incompatible_value",
            id,
            "Нет позиций",
        )
        if (colors.size < 2 || colors.size != locations.size) {
            failAssembly(
                "incompatible_value",
                id,
                "Некорректные стопы",
            )
        }
        val stops = colors.mapIndexed { index, entry ->
            val position = numeric(locations[index])
            if (position !in 0.0..1.0) {
                failAssembly(
                    "incompatible_value",
                    id,
                    "Позиция стопа вне диапазона",
                )
            }
            jsonObject("color" to string(color(entry, id)), "position" to number(position))
        }
        return jsonObject(
            "kind" to string("linear"),
            "angle" to number(numeric(layer["angle"] ?: JsonPrimitive(0))),
            "stops" to JsonArray(stops),
        )
    }
}

private fun loose(value: String): String = value.replace(Regex("[.-]"), "").lowercase(Locale.ROOT)
private fun numeric(value: JsonElement?): Double = value?.textOrNull()?.toDoubleOrNull()?.takeIf(Double::isFinite)
    ?: failAssembly("incompatible_value", "", "Некорректное числовое значение токена")
private fun color(value: JsonElement?, id: String): String {
    val hex = value?.textOrNull().orEmpty()
    if (!Regex("#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?").matches(hex)) {
        failAssembly(
            "incompatible_value",
            id,
            "Некорректный цвет",
        )
    }
    return (if (hex.length == 7) hex + "FF" else hex).uppercase(Locale.ROOT)
}
