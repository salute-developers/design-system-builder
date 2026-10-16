package com.dsbuilder.ds.themes.application.colortokens

/** Итог операции над цветовым токеном: новая ревизия текущей темы и значение операции. */
data class ColorTokenMutation<T>(
    /** Новая ревизия текущей темы. */
    val editRevision: Int,
    /** Значение операции. */
    val value: T,
)
