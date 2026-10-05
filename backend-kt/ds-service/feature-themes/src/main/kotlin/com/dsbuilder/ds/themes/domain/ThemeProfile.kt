package com.dsbuilder.ds.themes.domain

/** Поддерживаемый профиль начальной цветовой темы. */
enum class ThemeProfile(
    /** Строковое значение внешнего контракта. */
    val wireValue: String,
) {
    /** Профиль Sber. */
    SBER("sber"),

    /** Профиль Malachite. */
    MALACHITE("malachite"),

    /** Профиль B2B. */
    B2B("b2b"),

    /** Пользовательская палитра. */
    CUSTOM("custom"),
    ;

    companion object {
        /** Возвращает профиль по значению внешнего контракта. */
        fun fromWire(value: String?): ThemeProfile? = entries.firstOrNull { it.wireValue == value }
    }
}
