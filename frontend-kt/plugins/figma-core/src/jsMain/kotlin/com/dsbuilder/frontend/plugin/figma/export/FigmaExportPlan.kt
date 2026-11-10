package com.dsbuilder.frontend.plugin.figma.export

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject

/** Тема и версия, из которых построен план: их показывает отчёт. */
internal data class ExportThemeInfo(val themeName: String, val tenantId: String, val versionId: String?)

/** Цвет 0–1 по каналам, как в Figma. */
internal data class PlanColor(val r: Double, val g: Double, val b: Double, val a: Double) {
    fun toJson(): JsonObject = buildJsonObject {
        put("r", r)
        put("g", g)
        put("b", b)
        put("a", a)
    }
}

/** Значение переменной в одном режиме. */
internal sealed interface PlanValue {
    fun toJson(): JsonObject

    /** Цвет без ссылки. */
    data class Color(val color: PlanColor) : PlanValue {
        override fun toJson() = JsonObject(mapOf("kind" to JsonPrimitive("color")) + color.toJson())
    }

    /** Ссылка на переменную плана по ключу; [opacity] в процентах для составного цвета Figma. */
    data class Alias(val key: String, val opacity: Double? = null) : PlanValue {
        override fun toJson() = buildJsonObject {
            put("kind", "alias")
            put("key", key)
            opacity?.let { put("opacity", it) }
        }
    }

    /** Число. */
    data class Number(val value: Double) : PlanValue {
        override fun toJson() = buildJsonObject {
            put("kind", "number")
            put("value", value)
        }
    }

    /** Строка. */
    data class Text(val value: String) : PlanValue {
        override fun toJson() = buildJsonObject {
            put("kind", "string")
            put("value", value)
        }
    }
}

/** Режим коллекции: ключ стабилен, имя видит дизайнер. */
internal data class PlanMode(val key: String, val name: String)

/** Переменная с общим ключом DS Builder. */
internal data class PlanVariable(
    val key: String,
    val name: String,
    val type: String,
    val scopes: List<String>,
    val values: Map<String, PlanValue>,
) {
    fun toJson(): JsonObject = buildJsonObject {
        put("key", key)
        put("name", name)
        put("type", type)
        put("scopes", strings(scopes))
        putJsonObject("values") { values.forEach { (mode, value) -> put(mode, value.toJson()) } }
    }
}

/** Коллекция переменных. */
internal data class PlanCollection(
    val key: String,
    val name: String,
    val modes: List<PlanMode>,
    val variables: List<PlanVariable>,
) {
    fun toJson(): JsonObject = buildJsonObject {
        put("key", key)
        put("name", name)
        putJsonArray("modes") {
            modes.forEach {
                add(
                    buildJsonObject {
                        put("key", it.key)
                        put("name", it.name)
                    },
                )
            }
        }
        putJsonArray("variables") { variables.forEach { add(it.toJson()) } }
    }
}

/** Текстовый стиль: значения первого экрана и ключи переменных для привязки. */
internal data class PlanTextStyle(
    val key: String,
    val name: String,
    val fontFamily: String,
    val fontWeight: Int,
    val fontSize: Double,
    val lineHeight: Double,
    val letterSpacing: Double,
    val bindings: Map<String, String>,
) {
    fun toJson(): JsonObject = buildJsonObject {
        put("key", key)
        put("name", name)
        put("fontFamily", fontFamily)
        put("fontWeight", fontWeight)
        put("fontSize", fontSize)
        put("lineHeight", lineHeight)
        put("letterSpacing", letterSpacing)
        putJsonObject("bindings") { bindings.forEach { (field, key) -> put(field, key) } }
    }
}

/** Слой тени. */
internal data class PlanShadow(
    val x: Double,
    val y: Double,
    val blur: Double,
    val spread: Double,
    val color: PlanColor,
) {
    fun toJson(): JsonObject = buildJsonObject {
        put("x", x)
        put("y", y)
        put("blur", blur)
        put("spread", spread)
        put("color", color.toJson())
    }
}

/** Стиль эффектов из слоёв тени. */
internal data class PlanEffectStyle(val key: String, val name: String, val shadows: List<PlanShadow>) {
    fun toJson(): JsonObject = buildJsonObject {
        put("key", key)
        put("name", name)
        putJsonArray("shadows") { shadows.forEach { add(it.toJson()) } }
    }
}

/** Слой заливки: сплошной или линейный градиент с углом CSS; `key` привязывает цвет к переменной плана. */
internal sealed interface PlanPaint {
    fun toJson(): JsonObject

    /** Сплошная заливка. */
    data class Solid(val color: PlanColor, val key: String? = null) : PlanPaint {
        override fun toJson() = buildJsonObject {
            put("kind", "solid")
            put("color", color.toJson())
            key?.let { put("key", it) }
        }
    }

    /** Линейный градиент: [angle] в градусах CSS, позиции стопов 0–1, [keys] — переменные стопов по порядку. */
    data class Linear(
        val angle: Double,
        val stops: List<Pair<Double, PlanColor>>,
        val keys: List<String?> = emptyList(),
    ) : PlanPaint {
        override fun toJson() = buildJsonObject {
            put("kind", "linear")
            put("angle", angle)
            putJsonArray("stops") {
                stops.forEachIndexed { index, (position, color) ->
                    add(
                        buildJsonObject {
                            put("position", position)
                            put("color", color.toJson())
                            keys.getOrNull(index)?.let { put("key", it) }
                        },
                    )
                }
            }
        }
    }
}

/** Стиль заливки; слои идут сверху вниз, как в CSS. */
internal data class PlanPaintStyle(val key: String, val name: String, val paints: List<PlanPaint>) {
    fun toJson(): JsonObject = buildJsonObject {
        put("key", key)
        put("name", name)
        putJsonArray("paints") { paints.forEach { add(it.toJson()) } }
    }
}

/** Токен, который не попал в план, и причина. */
internal data class PlanSkip(val name: String, val reason: String) {
    fun toJson(): JsonObject = buildJsonObject {
        put("name", name)
        put("reason", reason)
    }
}

/** Всё, что основной поток должен записать в документ. */
internal data class FigmaExportPlan(
    val source: ExportThemeInfo,
    val collections: List<PlanCollection>,
    val textStyles: List<PlanTextStyle>,
    val effectStyles: List<PlanEffectStyle>,
    val paintStyles: List<PlanPaintStyle>,
    val skipped: List<PlanSkip>,
    val omittedDisabled: Int,
    val fontFiles: List<PlanFontFamily> = emptyList(),
    /** Экспортированное с оговоркой: отчёт показывает отдельно от пропусков. */
    val notes: List<PlanSkip> = emptyList(),
) {
    fun toJson(): JsonObject = buildJsonObject {
        putJsonObject("source") {
            put("themeName", source.themeName)
            put("tenantId", source.tenantId)
            put("versionId", source.versionId)
        }
        putJsonArray("collections") { collections.forEach { add(it.toJson()) } }
        putJsonArray("textStyles") { textStyles.forEach { add(it.toJson()) } }
        putJsonArray("effectStyles") { effectStyles.forEach { add(it.toJson()) } }
        putJsonArray("paintStyles") { paintStyles.forEach { add(it.toJson()) } }
        putJsonArray("skipped") { skipped.forEach { add(it.toJson()) } }
        putJsonArray("notes") { notes.forEach { add(it.toJson()) } }
        putJsonObject("omitted") {
            put("disabled", omittedDisabled)
        }
        putJsonArray("fontFiles") { fontFiles.forEach { add(it.toJson()) } }
    }
}

private fun strings(values: List<String>): JsonArray = buildJsonArray { values.forEach { add(JsonPrimitive(it)) } }

/** Доступ к полям ответа бэкенда без общей схемы. */
internal fun JsonElement?.obj(): JsonObject? = this as? JsonObject

internal fun JsonElement?.arr(): List<JsonElement> = (this as? JsonArray).orEmpty()

internal fun JsonObject.str(field: String): String? = (this[field] as? JsonPrimitive)?.takeIf { it.isString }?.content

internal fun JsonObject.num(field: String): Double? =
    (this[field] as? JsonPrimitive)?.takeIf { !it.isString }?.content?.toDoubleOrNull()

internal fun JsonObject.bool(field: String): Boolean? =
    (this[field] as? JsonPrimitive)?.takeIf { !it.isString }?.content?.toBooleanStrictOrNull()
