package com.dsbuilder.ds.themes.domain

/** Тип записи глобальной палитры. */
enum class ThemePaletteType(
    /** Строковое значение PostgreSQL enum. */
    val wireValue: String,
) {
    GENERAL("general"),
    ADDITIONAL("additional"),
    ;

    companion object {
        /** Возвращает тип по строковому контракту. */
        fun fromWire(value: String?): ThemePaletteType? = entries.firstOrNull { it.wireValue == value }
    }
}
