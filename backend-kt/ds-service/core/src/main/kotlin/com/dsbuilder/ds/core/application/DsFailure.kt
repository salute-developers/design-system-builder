package com.dsbuilder.ds.core.application

/** Failures safe to expose through the HTTP boundary. */
sealed interface DsFailure {
    /** Invalid request with a stable [code] and safe [details]. */
    data class InvalidRequest(
        val code: String,
        val details: Map<String, String> = emptyMap(),
        /** Whether this validation-shaped failure originated at the persistence boundary. */
        val transactionFailure: Boolean = false,
        /** Текст для пользователя; передаётся в `message` ответа. */
        val message: String? = null,
    ) : DsFailure

    /** Authorization policy denied the operation. */
    data object Forbidden : DsFailure

    /** Resource is absent or belongs to another project. */
    data object NotFound : DsFailure

    /** Persistence conflict identified by stable [code]. */
    data class Conflict(
        val code: String,
        /** Актуальная ревизия ресурса при optimistic-concurrency конфликте. */
        val editRevision: Int? = null,
        /** Whether this conflict originated at the persistence boundary. */
        val transactionFailure: Boolean = false,
        /** Текст для пользователя; передаётся в `message` ответа. */
        val message: String? = null,
        /** Числовые подробности конфликта, например `steps` у `PALETTE_STEP_MISSING`. */
        val details: Map<String, List<Int>> = emptyMap(),
    ) : DsFailure

    /** Valid request whose processing failed with stable [code] and safe public [message]. */
    data class Unprocessable(val code: String, val message: String) : DsFailure

    /** Required external [dependency] is unavailable. */
    data class DependencyUnavailable(val dependency: String) : DsFailure

    /** Unexpected implementation failure without internal details. */
    data object TechnicalFailure : DsFailure
}
