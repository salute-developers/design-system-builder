package com.dsbuilder.ds.core.application

/** Transaction boundary controlled by application use cases. */
interface TransactionRunner {
    /** Executes [block] in a writable transaction. */
    suspend fun <T> required(block: suspend () -> DsResult<T>): DsResult<T>

    /** Executes a mutation and exposes trusted actor metadata to persistence in the same transaction. */
    suspend fun <T> required(context: DsRequestContext, block: suspend () -> DsResult<T>): DsResult<T> = required(block)

    /** Executes [block] in a writable transaction and rolls all changes back after obtaining its result. */
    suspend fun <T> rollback(block: suspend () -> DsResult<T>): DsResult<T> = required(block)

    /** Executes [block] in a read-only transaction. */
    suspend fun <T> readOnly(block: suspend () -> DsResult<T>): DsResult<T>

    /** Executes a read with an optional published version selected by [context]. */
    suspend fun <T> readOnly(context: DsRequestContext, block: suspend () -> DsResult<T>): DsResult<T> = readOnly(block)

    /** Разрешает DS и версию ресурса перед чтением в той же транзакции. */
    suspend fun <T> readOnly(
        context: DsRequestContext,
        target: ModelReadTarget,
        block: suspend (DsRequestContext) -> DsResult<T>,
    ): DsResult<T> = readOnly(context) { block(context) }
}
