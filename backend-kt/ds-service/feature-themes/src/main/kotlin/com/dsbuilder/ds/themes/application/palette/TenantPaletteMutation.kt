package com.dsbuilder.ds.themes.application.palette

/** Итог операции изменения палитры: новая ревизия темы и значение операции. */
data class TenantPaletteMutation<T>(
    /** Новая ревизия темы. */
    val editRevision: Int,
    /** Значение операции. */
    val value: T,
)
