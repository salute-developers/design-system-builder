package com.dsbuilder.ds.themes.application.sizetokens

/** Итог операции над токеном размеров: новая ревизия текущей темы и значение операции. */
data class SizeTokenMutation<T>(
    /** Новая ревизия текущей темы. */
    val editRevision: Int,
    /** Значение операции. */
    val value: T,
)
