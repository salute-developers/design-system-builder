package com.dsbuilder.ds.themes.domain.palette

/** Вид группы палитры темы. */
enum class PaletteGroupKind(
    /** Значение PostgreSQL enum `palette_group_kind` и контракта. */
    val wireValue: String,
) {
    SYSTEM("system"),
    CUSTOM("custom"),
    ;

    companion object {
        /** Возвращает вид по строковому контракту. */
        fun fromWire(value: String?): PaletteGroupKind? = entries.firstOrNull { it.wireValue == value }
    }
}
