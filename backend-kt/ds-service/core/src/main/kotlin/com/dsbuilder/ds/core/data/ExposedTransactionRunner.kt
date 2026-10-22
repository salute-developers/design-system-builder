package com.dsbuilder.ds.core.data

import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentMutationRequest
import com.dsbuilder.ds.core.application.IdempotentReplayException
import com.dsbuilder.ds.core.application.IdempotentRequestLookup
import com.dsbuilder.ds.core.application.IdempotentResponse
import com.dsbuilder.ds.core.application.MAX_IDEMPOTENCY_KEY_LENGTH
import com.dsbuilder.ds.core.application.RequestHash
import com.dsbuilder.ds.core.application.TransactionFailureMapper
import com.dsbuilder.ds.core.application.TransactionRunner
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.jetbrains.exposed.v1.core.IColumnType
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.exceptions.ExposedSQLException
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import java.sql.Connection
import java.sql.SQLException

/** Executes application work in one JDBC transaction without leaking SQL failures. */
@Suppress("TooGenericExceptionCaught") // any failure of a transaction body is mapped to a closed DsFailure
class ExposedTransactionRunner(
    private val database: Database,
    private val failureMapper: TransactionFailureMapper,
) : TransactionRunner {
    override suspend fun <T> required(block: suspend () -> DsResult<T>): DsResult<T> = execute(readOnly = false, block)

    override suspend fun <T> required(
        context: DsRequestContext,
        block: suspend () -> DsResult<T>,
    ): DsResult<T> = execute(readOnly = false) {
        if (context.versionId != null) {
            return@execute DsResult.Failure(DsFailure.InvalidRequest("historical_version_read_only"))
        }
        configure(context)
        val request = context.mutationRequest
        if (request != null) {
            if (request.key.isBlank() || request.key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
                return@execute DsResult.Failure(DsFailure.InvalidRequest("invalid_idempotency_key"))
            }
            when (
                val lookup = ExposedIdempotentRequestRepository().lookup(
                    context.projectId,
                    request.key,
                    request.operation,
                    RequestHash.canonical(request.body),
                )
            ) {
                IdempotentRequestLookup.PayloadMismatch ->
                    return@execute DsResult.Failure(DsFailure.Conflict("IDEMPOTENCY_KEY_REUSED"))
                is IdempotentRequestLookup.Replayed -> throw IdempotentReplayException(lookup.response)
                IdempotentRequestLookup.New -> Unit
            }
        }
        when (val result = block()) {
            is DsResult.Failure -> result
            is DsResult.Success -> {
                if (request != null) saveMutationResponse(context, request, requireNotNull(result.value))
                result.copy(mutationMetadata = mutationMetadata())
            }
        }
    }

    private suspend fun saveMutationResponse(
        context: DsRequestContext,
        request: IdempotentMutationRequest,
        value: Any,
    ) {
        val encoder = requireNotNull(context.idempotentResponseEncoder) { "Mutation response encoder is required" }
        ExposedIdempotentRequestRepository().save(
            context.projectId,
            request.key,
            context.principal.actorId,
            request.operation,
            RequestHash.canonical(request.body),
            IdempotentResponse(request.responseStatus, encoder(value)),
        )
    }

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
    } catch (failure: SQLException) {
        DsResult.Failure(failureMapper.map(failure))
    }

    override suspend fun <T> readOnly(block: suspend () -> DsResult<T>): DsResult<T> = execute(readOnly = true, block)

    override suspend fun <T> readOnly(
        context: DsRequestContext,
        block: suspend () -> DsResult<T>,
    ): DsResult<T> = execute(readOnly = true) {
        configure(context)
        if (context.versionId != null && !versionAccessible(context)) {
            DsResult.Failure(DsFailure.NotFound)
        } else {
            block()
        }
    }

    private fun versionAccessible(context: DsRequestContext): Boolean {
        val versionId = requireNotNull(context.versionId)
        val access = if (context.principal.systemAdmin) "TRUE" else "system.project_id = ?"
        val args = mutableListOf<Pair<IColumnType<*>, Any?>>(UUIDColumnType() to versionId)
        if (!context.principal.systemAdmin) args += TextColumnType() to context.projectId.value
        return TransactionManager.current().exec(
            "SELECT EXISTS(" +
                "SELECT 1 FROM design_system_versions boundary " +
                "JOIN design_systems system ON system.id = boundary.design_system_id " +
                "WHERE boundary.id = ? AND boundary.status = 'published' " +
                "AND boundary.snapshot IS NULL AND $access)",
            args,
        ) { rows -> rows.next() && rows.getBoolean(1) } ?: false
    }

    private fun configure(context: DsRequestContext) {
        TransactionManager.current().exec(
            "SELECT set_config('ds.actor_id', ?, true)",
            listOf(TextColumnType() to context.principal.actorId),
        )
        TransactionManager.current().exec(
            "SELECT set_config('ds.project_id', ?, true)",
            listOf(TextColumnType() to context.projectId.value),
        )
        TransactionManager.current().exec(
            "SELECT set_config('ds.system_admin', ?, true)",
            listOf(TextColumnType() to context.principal.systemAdmin.toString()),
        )
        context.baseRevision?.let { revision ->
            TransactionManager.current().exec(
                "SELECT set_config('ds.base_revision', ?, true)",
                listOf(TextColumnType() to revision.toString()),
            )
        }
        context.clientId?.let { clientId ->
            TransactionManager.current().exec(
                "SELECT set_config('ds.client_id', ?, true)",
                listOf(TextColumnType() to clientId),
            )
        }
        context.versionId?.let { versionId ->
            TransactionManager.current().exec(
                "SELECT set_config('ds.version_id', ?, true)",
                listOf(TextColumnType() to versionId.toString()),
            )
        }
    }

    private fun mutationMetadata(): String? = TransactionManager.current().exec(
        "SELECT NULLIF(current_setting('ds.mutation_metadata', true), '')",
    ) { rows ->
        if (rows.next()) rows.getString(1) else null
    }

    @Suppress("ReturnCount")
    private suspend fun <T> execute(
        readOnly: Boolean,
        block: suspend () -> DsResult<T>,
    ): DsResult<T> {
        var lastFailure: SQLException? = null
        repeat(if (readOnly) 1 else SERIALIZABLE_ATTEMPTS) { attempt ->
            try {
                return withContext(Dispatchers.IO) {
                    transaction(database) {
                        connection.readOnly = readOnly
                        connection.transactionIsolation = if (readOnly) {
                            Connection.TRANSACTION_REPEATABLE_READ
                        } else {
                            Connection.TRANSACTION_SERIALIZABLE
                        }
                        val result = runBlocking { block() }
                        if (result is DsResult.Failure) rollback()
                        result
                    }
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: ExposedSQLException) {
                if (!failure.isRetryableTransactionFailure() || attempt == SERIALIZABLE_ATTEMPTS - 1) {
                    return DsResult.Failure(failureMapper.map(failure))
                }
                lastFailure = failure
            } catch (failure: SQLException) {
                if (!failure.isRetryableTransactionFailure() || attempt == SERIALIZABLE_ATTEMPTS - 1) {
                    return DsResult.Failure(failureMapper.map(failure))
                }
                lastFailure = failure
            }
        }
        return DsResult.Failure(failureMapper.map(requireNotNull(lastFailure)))
    }
}

private fun Throwable.isRetryableTransactionFailure(): Boolean = generateSequence(this) { it.cause }
    .filterIsInstance<SQLException>()
    .any { it.sqlState == SERIALIZATION_FAILURE || it.sqlState == DEADLOCK_DETECTED }

private const val SERIALIZATION_FAILURE = "40001"
private const val DEADLOCK_DETECTED = "40P01"
private const val SERIALIZABLE_ATTEMPTS = 3
