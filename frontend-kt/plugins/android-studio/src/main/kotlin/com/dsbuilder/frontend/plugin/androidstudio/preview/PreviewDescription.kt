package com.dsbuilder.frontend.plugin.androidstudio.preview

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.longOrNull

/** Проверяет описанные поля истории и сохраняет типы значений по умолчанию. */
internal fun previewExampleProps(description: JsonObject): JsonObject {
    val raw = description["properties"] as? JsonArray ?: error("В описании отсутствуют свойства истории")
    val properties = raw.map { it as? JsonObject ?: error("Некорректное свойство истории") }
    val names = properties.map { it.text("name").orEmpty() }
    check(names.all(String::isNotBlank) && names.distinct().size == names.size) { "Некорректные имена свойств истории" }
    properties.forEach { property ->
        val valid = validPropertyDefault(property)
        check(valid) { "Некорректное значение свойства истории: ${property.text("name")}" }
    }
    return JsonObject(properties.associate { requireNotNull(it.text("name")) to requireNotNull(it["defaultValue"]) })
}

private fun validPropertyDefault(property: JsonObject): Boolean {
    val value = property["defaultValue"] as? JsonPrimitive ?: error("Нет значения свойства истории")
    return when (property.text("type")) {
        "string" -> value.isString
        "boolean" -> !value.isString && value.content in setOf("true", "false")
        "int" -> !value.isString && value.longOrNull != null
        "float" -> !value.isString && value.doubleOrNull?.isFinite() == true
        "singleChoice" -> validChoice(property, value)
        else -> false
    }
}

private fun validChoice(property: JsonObject, value: JsonPrimitive): Boolean {
    val variants = property["variants"] as? JsonArray ?: return false
    return value.isString && variants.all { it is JsonPrimitive && it.isString } && value in variants
}
