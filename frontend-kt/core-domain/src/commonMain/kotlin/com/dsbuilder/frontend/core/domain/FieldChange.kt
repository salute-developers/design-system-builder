package com.dsbuilder.frontend.core.domain

/** Различает отсутствие изменения и явную запись null в частичном обновлении. */
public sealed interface FieldChange<out T> {
    /** Поле отсутствует в запросе. */
    public data object Unchanged : FieldChange<Nothing>

    /** Поле присутствует, null сбрасывает его по правилам backend. */
    public data class Set<T>(
        /** Переданное значение или явный сброс. */
        public val value: T?,
    ) : FieldChange<T>
}
