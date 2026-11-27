package com.dsbuilder.ds.core.domain

/** Текущая доступность опубликованных версий, независимая от истории содержимого. */
enum class DesignSystemVisibility(
    /** Точное значение внешнего JSON и столбца visibility. */
    val value: String,
) {
    /** Доступ только по проектным правам. */
    PRIVATE("private"),

    /** Опубликованные версии доступны по прямому адресу. */
    PUBLIC("public"),
    ;

    companion object {
        /** Разбирает только точные значения внешнего контракта. */
        fun parse(value: String): DesignSystemVisibility? = entries.find { it.value == value }
    }
}
