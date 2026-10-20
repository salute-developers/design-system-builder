package com.dsbuilder.ds.themes.domain.typography

/** Правила значений стиля из прототипа SDDS Portal; вес ограничен шагом 100 — у iOS нет промежуточных весов. */
object TypographyValueRules {
    /** Ошибка размера и высоты строки. */
    const val SIZE_MESSAGE = "Размер и межстрочный интервал должны быть положительными числами."

    /** Ошибка трекинга. */
    const val LETTER_SPACING_MESSAGE = "Letter spacing должен быть в диапазоне от -0.2em до 1em."

    /** Ошибка веса. */
    const val WEIGHT_MESSAGE = "Вес шрифта должен быть числом от 100 до 900 с шагом 100."

    /** Ошибка семейства. */
    const val FONT_FAMILY_MESSAGE = "Такого семейства шрифта нет в дизайн-системе."

    /** Допустимый трекинг в em. */
    private val LETTER_SPACING = -0.2..1.0

    /** Первое нарушение в размерах экрана и весах начертаний или `null`. */
    fun validate(
        sizePx: Double?,
        lineHeightPx: Double?,
        letterSpacingEm: Double?,
        weights: Map<TypographyVariant, Int>,
    ): TypographyValueViolation? = when {
        sizePx != null && !(sizePx.isFinite() && sizePx > 0) -> TypographyValueViolation("size", SIZE_MESSAGE)
        lineHeightPx != null && !(lineHeightPx.isFinite() && lineHeightPx > 0) ->
            TypographyValueViolation("lineHeight", SIZE_MESSAGE)
        letterSpacingEm != null && !(letterSpacingEm.isFinite() && letterSpacingEm in LETTER_SPACING) ->
            TypographyValueViolation("letterSpacing", LETTER_SPACING_MESSAGE)
        else ->
            weights.entries
                .sortedBy { it.key.ordinal }
                .firstOrNull { (_, weight) -> weight !in TypographyPlatformValues.IOS_WEIGHTS }
                ?.let { (variant, _) -> TypographyValueViolation("weights.${variant.wireValue}", WEIGHT_MESSAGE) }
    }
}
