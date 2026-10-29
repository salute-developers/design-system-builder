package com.dsbuilder.ds.themes.domain

/** Режим значения токена темы. */
enum class ThemeTokenMode(
    /** Строковое значение PostgreSQL enum. */
    val wireValue: String,
) {
    /** Светлый режим. */
    LIGHT("light"),

    /** Тёмный режим. */
    DARK("dark"),
    ;

    companion object {
        /** Возвращает значение по строковому контракту. */
        fun fromWire(value: String?): ThemeTokenMode? = entries.firstOrNull { it.wireValue == value }
    }
}
