package com.dsbuilder.ds.themes.domain.palette

/** Стратегия удаления растяжки со связями. */
enum class RemoveRampStrategy(
    /** Значение контракта. */
    val wireValue: String,
) {
    /** Ссылки переходят на растяжку замены. */
    REPLACE("replace"),

    /** Ссылки становятся HEX текущих значений. */
    DETACH("detach"),
    ;

    companion object {
        /** Возвращает стратегию по строковому контракту. */
        fun fromWire(value: String?): RemoveRampStrategy? = entries.firstOrNull { it.wireValue == value }
    }
}
