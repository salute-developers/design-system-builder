package com.dsbuilder.ds.components.domain

/** Размер иконки в пикселях. */
enum class IconSize(
    /** Размер в пикселях. */
    val px: Int,
) {
    /** 16 px. */
    S16(16),

    /** 24 px. */
    S24(24),

    /** 36 px. */
    S36(36),
    ;

    /** Разбор значения. */
    companion object {
        /** Размер по числу пикселей; неподдерживаемый размер даёт `null`. */
        fun fromPx(value: Int): IconSize? = entries.firstOrNull { it.px == value }
    }
}
