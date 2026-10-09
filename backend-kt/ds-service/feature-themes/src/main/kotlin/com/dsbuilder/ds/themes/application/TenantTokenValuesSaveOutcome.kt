package com.dsbuilder.ds.themes.application

/** Результат атомарного сохранения значений темы на persistence-границе. */
sealed interface TenantTokenValuesSaveOutcome {
    /** Значения сохранены и ревизия увеличена. */
    data class Saved(/** Новая ревизия темы. */ val editRevision: Int) : TenantTokenValuesSaveOutcome

    /** Сохранённая ревизия отличается от ожидаемой. */
    data class RevisionConflict(/** Актуальная ревизия темы. */ val editRevision: Int) : TenantTokenValuesSaveOutcome

    /** Тема недоступна текущему проекту. */
    data object NotFound : TenantTokenValuesSaveOutcome

    /** Хотя бы один токен не принадлежит дизайн-системе темы. */
    data object ForeignToken : TenantTokenValuesSaveOutcome
}
