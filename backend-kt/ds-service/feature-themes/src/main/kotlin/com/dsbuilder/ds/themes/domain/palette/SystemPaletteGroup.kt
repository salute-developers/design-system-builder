package com.dsbuilder.ds.themes.domain.palette

/** Системные группы палитры в порядке отображения; подписи — из прототипа SDDS Portal. */
enum class SystemPaletteGroup(
    /** Ключ группы в контракте (`systemKey`). */
    val wireValue: String,
    /** Подпись группы. */
    val label: String,
) {
    NEUTRAL("neutral", "Neutral"),
    ACCENT("accent", "Accent"),
    STATUS("status", "Статус"),
    DATA("data", "Data"),
    SYNTAX("syntax", "Syntax"),
    ;

    companion object {
        /** Возвращает группу по ключу контракта. */
        fun fromWire(value: String?): SystemPaletteGroup? = entries.firstOrNull { it.wireValue == value }
    }
}
