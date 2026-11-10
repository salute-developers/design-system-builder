package com.dsbuilder.frontend.plugin.figma.export

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

/** Файлы по `https`, которые устанавливаются на компьютер; `woff2` веба Figma desktop не подхватит. */
private val INSTALLABLE = Regex("^https://[^?#]+\\.(otf|ttf)([?#].*)?$", RegexOption.IGNORE_CASE)

/** Файл начертания из значения токена `fontFamily`: имя файла, ссылка, насыщенность и стиль, как в значении. */
internal data class PlanFontFile(val name: String, val url: String, val weight: String?, val style: String?) {
    fun toJson(): JsonObject = buildJsonObject {
        put("name", name)
        put("url", url)
        weight?.let { put("weight", it) }
        style?.let { put("style", it) }
    }
}

/** Ссылки на файлы начертаний семейства Figma: их показывает отчёт, если шрифта нет. */
internal data class PlanFontFamily(val family: String, val files: List<PlanFontFile>) {
    fun toJson(): JsonObject = buildJsonObject {
        put("family", family)
        putJsonArray("files") { files.forEach { add(it.toJson()) } }
    }
}

/**
 * Файлы начертаний из значений токенов `fontFamily` (`fonts[].link` платформ iOS и Android) для [families] —
 * имён шрифтов, которые использует типографика. Повторы одной ссылки на разных платформах убираются.
 */
internal fun fontFiles(source: JsonObject, families: Collection<String>): List<PlanFontFamily> {
    val fontTokens = source["tokens"].arr().mapNotNull { it.obj() }
        .filter { it.str("type") == "fontFamily" && it.bool("enabled") != false }
        .mapNotNull { it.str("id") }
        .toSet()
    val byFamily = mutableMapOf<String, MutableMap<String, PlanFontFile>>()
    source["values"].arr().mapNotNull { it.obj() }
        .filter { it.str("tokenId") in fontTokens }
        .flatMap { it["value"].arr() }
        .mapNotNull { it.obj() }
        .forEach { family ->
            val name = family.str("name") ?: return@forEach
            if (name !in families) return@forEach
            val files = byFamily.getOrPut(name) { linkedMapOf() }
            family["fonts"].arr().mapNotNull { it.obj() }.forEach { font ->
                val url = font.str("link")?.takeIf(INSTALLABLE::matches) ?: return@forEach
                val file = PlanFontFile(
                    decodeURIComponent(url.substringBefore('?').substringBefore('#').substringAfterLast('/')),
                    url,
                    font.str("weight"),
                    font.str("style"),
                )
                // Одна ссылка на iOS и Android: насыщенность берётся у той записи, где она есть.
                if (files[url]?.weight == null) files[url] = file
            }
        }
    return families.mapNotNull { family ->
        byFamily[family]?.values?.sortedBy { it.name }?.takeIf { it.isNotEmpty() }?.let { PlanFontFamily(family, it) }
    }
}

/** Имя файла из ссылки читается без `%20`; битая последовательность оставляет имя как есть. */
private fun decodeURIComponent(value: String): String =
    runCatching { js("decodeURIComponent")(value) as String }.getOrDefault(value)
