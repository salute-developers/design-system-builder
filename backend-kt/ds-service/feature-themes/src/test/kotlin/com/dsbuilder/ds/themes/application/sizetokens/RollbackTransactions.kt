package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/**
 * Транзакции use case над хранилищем в памяти по правилам `ExposedTransactionRunner`: мутация с `versionId` —
 * `400 historical_version_read_only`, отказ откатывает все записи хранилища [tokens].
 */
internal class RollbackTransactions(private val tokens: FakeSizeTokenRepository) : TransactionRunner {
    /** Последний контекст чтения. */
    var readContext: DsRequestContext? = null

    override suspend fun <T> required(block: suspend () -> DsResult<T>): DsResult<T> {
        val before = tokens.state()
        return block().also { if (it is DsResult.Failure) tokens.restore(before) }
    }

    override suspend fun <T> required(context: DsRequestContext, block: suspend () -> DsResult<T>): DsResult<T> =
        if (context.versionId != null) {
            DsResult.Failure(DsFailure.InvalidRequest("historical_version_read_only"))
        } else {
            required(block)
        }

    override suspend fun <T> readOnly(block: suspend () -> DsResult<T>): DsResult<T> = block()

    override suspend fun <T> readOnly(context: DsRequestContext, block: suspend () -> DsResult<T>): DsResult<T> {
        readContext = context
        return block()
    }
}
