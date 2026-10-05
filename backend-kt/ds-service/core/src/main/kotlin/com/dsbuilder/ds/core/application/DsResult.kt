package com.dsbuilder.ds.core.application

/** Typed application result independent of HTTP and persistence details. */
sealed interface DsResult<out T> {
    /** Successful application result carrying [value]. */
    data class Success<T>(val value: T) : DsResult<T>

    /** Failed application result carrying a safe [error]. */
    data class Failure(val error: DsFailure) : DsResult<Nothing>
}
