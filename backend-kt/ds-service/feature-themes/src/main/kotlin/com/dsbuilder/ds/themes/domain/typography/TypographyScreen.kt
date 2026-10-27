package com.dsbuilder.ds.themes.domain.typography

/** Размер экрана, для которого заданы стили типографии; порядок — от крупного к мелкому. */
enum class TypographyScreen(
    /** Префикс имени токена. */
    val wireValue: String,
) {
    /** Крупные экраны. */
    L("screen-l"),

    /** Средние экраны. */
    M("screen-m"),

    /** Мелкие экраны. */
    S("screen-s"),
    ;

    companion object {
        /** Экран по префиксу имени токена. */
        fun fromWire(value: String?): TypographyScreen? = entries.firstOrNull { it.wireValue == value }
    }
}
