package com.dsbuilder.ds.themes.domain

/** Тип токена, необходимый при инициализации значений темы. */
enum class ThemeTokenType(
    /** Строковое значение PostgreSQL enum. */
    val wireValue: String,
) {
    COLOR("color"),
    GRADIENT("gradient"),
    TYPOGRAPHY("typography"),
    SHADOW("shadow"),
    SHAPE("shape"),
    SPACING("spacing"),
    FONT_FAMILY("fontFamily"),
    ;

    companion object {
        /** Возвращает тип по строковому контракту. */
        fun fromWire(value: String?): ThemeTokenType? = entries.firstOrNull { it.wireValue == value }
    }
}
