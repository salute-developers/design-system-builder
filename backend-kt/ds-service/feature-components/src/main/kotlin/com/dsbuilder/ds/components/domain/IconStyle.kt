package com.dsbuilder.ds.components.domain

/** Начертание иконки, выделенное из суффикса канонического имени. */
enum class IconStyle(
    /** Значение в API и БД. */
    val wire: String,
    /** Суффикс имени. */
    val suffix: String,
) {
    /** Контур, суффикс `Outline`. */
    OUTLINE("outline", "Outline"),

    /** Жирный контур, суффикс `OutlineBold`. */
    OUTLINE_BOLD("outline-bold", "OutlineBold"),

    /** Заливка, суффикс `Fill`. */
    FILL("fill", "Fill"),

    /** Имя без суффикса начертания. */
    NONE("none", ""),
    ;

    /** Разбор значения. */
    companion object {
        /** Начертание по значению API; неизвестное значение даёт `null`. */
        fun fromWire(value: String): IconStyle? = entries.firstOrNull { it.wire == value }
    }
}
