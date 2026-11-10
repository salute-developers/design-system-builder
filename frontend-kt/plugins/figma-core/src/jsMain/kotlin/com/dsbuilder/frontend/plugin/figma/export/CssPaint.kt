package com.dsbuilder.frontend.plugin.figma.export

private const val CHANNEL_MAX = 255.0
private const val PERCENT = 100.0
private const val HEX_RADIX = 16
private const val SHORT_RGB = 3
private const val SHORT_RGBA = 4
private const val LONG_RGB = 6
private const val LONG_RGBA = 8
private const val CSS_DEFAULT_ANGLE = 180.0

private val HEX = Regex("^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
private val LINEAR = Regex("^linear-gradient\\((.*)\\)$", RegexOption.IGNORE_CASE)
private val ANGLE = Regex("^(-?\\d+(?:\\.\\d+)?)deg$", RegexOption.IGNORE_CASE)
private val STOP = Regex("^(#[0-9a-fA-F]{3,8})(?:\\s+(-?\\d+(?:\\.\\d+)?)%)?$")
private val SIDES = mapOf(
    "to top" to 0.0,
    "to top right" to 45.0,
    "to right top" to 45.0,
    "to right" to 90.0,
    "to bottom right" to 135.0,
    "to right bottom" to 135.0,
    "to bottom" to 180.0,
    "to bottom left" to 225.0,
    "to left bottom" to 225.0,
    "to left" to 270.0,
    "to top left" to 315.0,
    "to left top" to 315.0,
)

/** Цвет из `#RGB`, `#RGBA`, `#RRGGBB` или `#RRGGBBAA`; иначе `null`. */
internal fun parseHex(raw: String): PlanColor? {
    val digits = HEX.matchEntire(raw.trim())?.groupValues?.get(1) ?: return null
    val full = if (digits.length == SHORT_RGB || digits.length == SHORT_RGBA) {
        digits.map { "$it$it" }.joinToString("")
    } else {
        digits
    }
    val channels = full.chunked(2).map { it.toInt(HEX_RADIX) / CHANNEL_MAX }
    return PlanColor(channels[0], channels[1], channels[2], channels.getOrElse(SHORT_RGB) { 1.0 })
        .takeIf { full.length == LONG_RGB || full.length == LONG_RGBA }
}

/** Слой значения web: HEX или `linear-gradient` с HEX-стопами; остальное не поддерживается. */
internal fun parsePaint(layer: String): PlanPaint? {
    parseHex(layer)?.let { return PlanPaint.Solid(it) }
    val body = LINEAR.matchEntire(layer.trim())?.groupValues?.get(1) ?: return null
    val parts = splitTopLevel(body)
    val angle = parts.firstOrNull()?.let(::parseAngle)
    val stopParts = if (angle == null) parts else parts.drop(1)
    val stops = parseStops(stopParts) ?: return null
    return PlanPaint.Linear(angle ?: CSS_DEFAULT_ANGLE, stops)
}

private fun parseAngle(part: String): Double? {
    val text = part.trim().lowercase().replace(Regex("\\s+"), " ")
    return ANGLE.matchEntire(text)?.groupValues?.get(1)?.toDouble() ?: SIDES[text]
}

/** Стопы без позиции распределяются равномерно между соседями, как в CSS. */
private fun parseStops(parts: List<String>): List<Pair<Double, PlanColor>>? {
    val parsed = parts.map { part ->
        val match = STOP.matchEntire(part.trim()) ?: return null
        val color = parseHex(match.groupValues[1]) ?: return null
        color to match.groupValues[2].takeIf { it.isNotEmpty() }?.toDouble()?.div(PERCENT)
    }
    if (parsed.size < 2) return null
    val positions = parsed.map { it.second }.toMutableList()
    if (positions.first() == null) positions[0] = 0.0
    if (positions.last() == null) positions[positions.lastIndex] = 1.0
    var start = 0
    for (index in 1 until positions.size) {
        val position = positions[index] ?: continue
        val from = positions[start]!!
        val gap = index - start
        for (step in 1 until gap) positions[start + step] = from + (position - from) * step / gap
        start = index
    }
    return parsed.mapIndexed { index, (color, _) -> positions[index]!!.coerceIn(0.0, 1.0) to color }
}

/** Делит аргументы CSS-функции по запятым верхнего уровня. */
private fun splitTopLevel(body: String): List<String> {
    val parts = mutableListOf<String>()
    var depth = 0
    val current = StringBuilder()
    for (char in body) {
        when {
            char == '(' -> depth++
            char == ')' -> depth--
        }
        if (char == ',' && depth == 0) {
            parts += current.toString().trim()
            current.clear()
        } else {
            current.append(char)
        }
    }
    parts += current.toString().trim()
    return parts.filter { it.isNotEmpty() }
}

/** Прозрачность ссылки палитры 0–1 в процентах составного цвета Figma. */
internal fun opacityPercent(opacity: Double): Double = kotlin.math.round(opacity * PERCENT * PERCENT) / PERCENT
