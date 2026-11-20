package com.dsbuilder.ds.components.application

/** Итог загрузки. */
enum class IconPublishOutcome(
    /** Значение в API. */
    val wire: String,
) {
    /** Записан новый каталог. */
    PUBLISHED("published"),

    /** Каталог совпал с активным. */
    UNCHANGED("unchanged"),

    /** Активной стала ранее записанная загрузка. */
    ACTIVATED("activated"),
}
