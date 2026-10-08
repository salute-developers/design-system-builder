package com.dsbuilder.ds.core.data

import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionFailureMapper
import com.dsbuilder.ds.core.application.TransactionRunner
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.jetbrains.exposed.v1.exceptions.ExposedSQLException
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.transaction

/** Executes application work in one JDBC transaction without leaking SQL failures. */
class ExposedTransactionRunner(
    private val database: Database,
    private val failureMapper: TransactionFailureMapper,
) : TransactionRunner {
    override suspend fun <T> required(block: suspend () -> DsResult<T>): DsResult<T> = execute(readOnly = false, block)

    // Любой сбой транзакции отображается в безопасный DsFailure: SQL-исключения не должны утекать наружу.
    @Suppress("TooGenericExceptionCaught")
    override suspend fun <T> rollback(block: suspend () -> DsResult<T>): DsResult<T> = try {
        withContext(Dispatchers.IO) {
            transaction(database) {
                val result = runBlocking { block() }
                rollback()
                result
            }
        }
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (failure: ExposedSQLException) {
        DsResult.Failure(failureMapper.map(failure))
    } catch (failure: Exception) {
        DsResult.Failure(failureMapper.map(failure))
    }

    override suspend fun <T> readOnly(block: suspend () -> DsResult<T>): DsResult<T> = execute(readOnly = true, block)

    // Любой сбой транзакции отображается в безопасный DsFailure: SQL-исключения не должны утекать наружу.
    @Suppress("TooGenericExceptionCaught")
    private suspend fun <T> execute(
        readOnly: Boolean,
        block: suspend () -> DsResult<T>,
    ): DsResult<T> = try {
        withContext(Dispatchers.IO) {
            transaction(database) {
                connection.readOnly = readOnly
                val result = runBlocking { block() }
                if (result is DsResult.Failure) rollback()
                result
            }
        }
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (failure: ExposedSQLException) {
        DsResult.Failure(failureMapper.map(failure))
    } catch (failure: Exception) {
        DsResult.Failure(failureMapper.map(failure))
    }
}
