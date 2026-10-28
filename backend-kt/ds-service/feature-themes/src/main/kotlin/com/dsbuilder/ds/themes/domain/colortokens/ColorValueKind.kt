package com.dsbuilder.ds.themes.domain.colortokens

/** Вид значения цветового токена в паре «тема × режим» на платформе. */
enum class ColorValueKind {
    /** Сплошной цвет: HEX, ссылка на ступень палитры или слой `color`. */
    COLOR,

    /** Градиент: хотя бы один слой — градиентная функция web или слой градиента iOS и Android. */
    GRADIENT,
}
