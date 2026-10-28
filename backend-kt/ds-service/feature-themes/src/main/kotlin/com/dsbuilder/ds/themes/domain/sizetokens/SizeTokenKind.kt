package com.dsbuilder.ds.themes.domain.sizetokens

import com.dsbuilder.ds.themes.domain.ThemeTokenType

/** Раздел экрана «Отступы, радиусы и тени» и тип токена темы, который в нём правится. */
enum class SizeTokenKind(
    /** Строковое значение в API: `radius`, `spacing` или `shadow`. */
    val wireValue: String,
    /** Тип токена в `tokens.type`. */
    val type: ThemeTokenType,
) {
    /** Радиус скругления — токен `shape` с именем `round.<имя>`. */
    RADIUS("radius", ThemeTokenType.SHAPE),

    /** Отступ — токен `spacing` с именем `spacing.<имя>`. */
    SPACING("spacing", ThemeTokenType.SPACING),

    /** Вариант тени — токен `shadow` с именем `<down|up>.<soft|hard>.<размер>`. */
    SHADOW("shadow", ThemeTokenType.SHADOW),
    ;

    companion object {
        /** Раздел по строковому значению API или `null`. */
        fun fromWire(value: String?): SizeTokenKind? = entries.firstOrNull { it.wireValue == value }
    }
}
