package com.dsbuilder.ds.themes.domain.sizetokens

/** Итог проверки значения токена размеров. */
sealed interface SizeValueCheck<out T> {
    /** Значение верно. */
    data class Valid<T>(
        /** Разобранное значение. */
        val value: T,
    ) : SizeValueCheck<T>

    /** Значение неверно. */
    data class Invalid(
        /** Первое нарушение. */
        val violation: SizeValueViolation,
    ) : SizeValueCheck<Nothing>
}
