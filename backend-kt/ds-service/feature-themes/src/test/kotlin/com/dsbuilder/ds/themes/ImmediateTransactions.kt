package com.dsbuilder.ds.themes

import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Транзакции use case без базы: блок выполняется сразу. */
internal class ImmediateTransactions : TransactionRunner {
    override suspend fun <T> rollback(
        context: DsRequestContext,
        block: suspend () -> DsResult<T>,
    ): DsResult<T> = required(context, block)

    override suspend fun <T> required(block: suspend () -> DsResult<T>) = block()

    override suspend fun <T> readOnly(block: suspend () -> DsResult<T>) = block()
}
