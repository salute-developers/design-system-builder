package com.dsbuilder.ds.themes.domain.colortokens

import com.dsbuilder.ds.themes.domain.palette.PaletteReference

/**
 * Грамматика web-градиента, которую порождает редактор: `linear-gradient(<a>deg, …)`,
 * `radial-gradient(<r>% <r>% at <x>% <y>%, …)` и `conic-gradient(from <a>deg at <x>% <y>%, …)`. Стопы —
 * `#RRGGBB`, `#RRGGBBAA` или ссылка `[type.shade.step][o]` с позицией `N%`; стопов не меньше двух, позиции не
 * убывают и лежат от 0 до 100. Узкая грамматика позволяет однозначно построить слой iOS и Android.
 */
object WebGradientGrammar {
    private const val SIGNED = """-?\d+(?:\.\d+)?"""
    private const val UNSIGNED = """\d+(?:\.\d+)?"""
    private const val MAX_PERCENT = 100.0
    private const val MIN_STOPS = 2
    private val FUNCTION = Regex("""^\s*(linear|radial|conic)-gradient\((.*)\)\s*$""", RegexOption.DOT_MATCHES_ALL)
    private val LINEAR = Regex("""^($SIGNED)deg$""")
    private val RADIAL = Regex("""^($UNSIGNED)%\s+($UNSIGNED)%\s+at\s+($UNSIGNED)%\s+($UNSIGNED)%$""")
    private val CONIC = Regex("""^from\s+($SIGNED)deg\s+at\s+($UNSIGNED)%\s+($UNSIGNED)%$""")
    private val STOP = Regex("""^(#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?|\[[^\]\s]+](?:\[[^\]\s]+])?)\s+($UNSIGNED)%$""")

    /** Записан ли слой [layer] градиентной функцией `linear`, `radial` или `conic`, даже с ошибкой внутри. */
    fun isFunction(layer: String): Boolean = FUNCTION.matches(layer)

    /** Разобранный слой или `null`, если [layer] не градиентная функция или нарушает грамматику. */
    @Suppress("ReturnCount")
    fun parse(layer: String): WebGradientLayer? {
        val match = FUNCTION.matchEntire(layer) ?: return null
        val parts = match.groupValues[2].split(',').map(String::trim)
        val stops = stops(parts.drop(1)) ?: return null
        val head = parts.first()
        return when (match.groupValues[1]) {
            "linear" -> LINEAR.matchEntire(head)?.let { WebGradientLayer.Linear(it.number(1), stops) }
            "radial" -> RADIAL.matchEntire(head)?.let { radial ->
                val numbers = (1..4).map { radial.number(it) }
                // Один радиус: второй должен совпадать, иначе слой не строится для iOS и Android однозначно.
                WebGradientLayer.Radial(numbers[0], numbers[2], numbers[3], stops)
                    .takeIf { numbers[0] == numbers[1] && numbers[2].percent() && numbers[3].percent() }
            }
            else -> CONIC.matchEntire(head)?.let { conic ->
                val (from, x, y) = (1..3).map { conic.number(it) }
                WebGradientLayer.Conic(from, x, y, stops).takeIf { x.percent() && y.percent() }
            }
        }
    }

    private fun stops(parts: List<String>): List<GradientStop>? {
        val stops = parts.map { stop(it) ?: return null }
        val ordered = stops.zipWithNext().all { (left, right) -> left.position <= right.position }
        return stops.takeIf { it.size >= MIN_STOPS && ordered }
    }

    private fun stop(part: String): GradientStop? {
        val match = STOP.matchEntire(part) ?: return null
        val raw = match.groupValues[1]
        val color = if (raw.startsWith("#")) StopColor.Hex(raw) else PaletteReference.parse(raw)?.let(StopColor::Ref)
        val position = match.number(2).takeIf { it.percent() }
        return if (color == null || position == null) null else GradientStop(color, position)
    }

    private fun MatchResult.number(group: Int): Double = groupValues[group].toDouble()

    private fun Double.percent(): Boolean = this in 0.0..MAX_PERCENT
}
