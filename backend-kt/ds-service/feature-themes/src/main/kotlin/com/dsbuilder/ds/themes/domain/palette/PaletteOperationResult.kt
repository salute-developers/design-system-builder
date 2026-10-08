package com.dsbuilder.ds.themes.domain.palette

/** Результат чистой операции палитры: новое состояние и значение либо отказ. */
sealed interface PaletteOperationResult<out T> {
    /** Успех: состояние с увеличенной ревизией и значение операции. */
    data class Applied<T>(
        /** Новое состояние палитры. */
        val state: TenantPaletteState,
        /** Значение операции. */
        val value: T,
    ) : PaletteOperationResult<T>

    /** Отказ. */
    data class Rejected(
        /** Причина. */
        val error: PaletteError,
    ) : PaletteOperationResult<Nothing>
}
