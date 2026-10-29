package com.dsbuilder.ds.components.domain

/** Вид области действия значения свойства в оформлении. */
enum class EditorValueKind {
    /** Значение базы оформления без привязки к стилю. */
    INVARIANT,

    /** Значение одного стиля оси. */
    VARIATION,

    /** Значение сочетания стилей нескольких осей. */
    COMBINATION,
}
