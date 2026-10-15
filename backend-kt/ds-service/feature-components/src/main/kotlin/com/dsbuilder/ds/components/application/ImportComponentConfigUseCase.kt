package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ComponentConfigImportResult
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentReplayException
import com.dsbuilder.ds.core.application.IdempotentRequestLookup
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.IdempotentResponse
import com.dsbuilder.ds.core.application.MAX_IDEMPOTENCY_KEY_LENGTH
import com.dsbuilder.ds.core.application.RequestHash
import com.dsbuilder.ds.core.application.TransactionRunner

/** Imports a package in one transaction, including dry-run rollback and change journaling. */
class ImportComponentConfigUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentConfigRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: ImportComponentConfig,
        idempotencyKey: String? = null,
    ): DsResult<ComponentConfigImportResult> {
        if (idempotencyKey != null && idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
            return DsResult.Failure(DsFailure.InvalidRequest("idempotency_key_too_long"))
        }
        return executeValid(context, command, idempotencyKey)
    }

    private suspend fun executeValid(
        context: DsRequestContext,
        command: ImportComponentConfig,
        idempotencyKey: String?,
    ): DsResult<ComponentConfigImportResult> = policy.read(context, ProjectScope.COMPONENTS_WRITE) {
        val execute = suspend {
            when (val attempt = repository.import(context.projectId, context.principal.systemAdmin, command)) {
                is ComponentConfigRepository.ImportAttempt.Success -> DsResult.Success(attempt.value)
                ComponentConfigRepository.ImportAttempt.NotFound -> DsResult.Failure(DsFailure.NotFound)
                ComponentConfigRepository.ImportAttempt.GlobalForbidden -> DsResult.Failure(DsFailure.Forbidden)
                is ComponentConfigRepository.ImportAttempt.Failed -> DsResult.Failure(
                    DsFailure.Unprocessable("Import failed", attempt.reason),
                )
            }
        }
        if (command.dryRun) {
            transactions.rollback(execute)
        } else {
            transactions.required(context) {
                if (idempotencyKey.isNullOrBlank()) return@required execute()
                val operation = "import-component-config"
                val hash = RequestHash.canonical(command)
                when (val previous = repeatedRequests.lookup(context.projectId, idempotencyKey, operation, hash)) {
                    IdempotentRequestLookup.PayloadMismatch ->
                        DsResult.Failure(DsFailure.Conflict("IDEMPOTENCY_KEY_REUSED"))
                    is IdempotentRequestLookup.Replayed -> throw IdempotentReplayException(previous.response)
                    IdempotentRequestLookup.New -> when (val result = execute()) {
                        is DsResult.Failure -> result
                        is DsResult.Success -> {
                            repeatedRequests.save(
                                context.projectId,
                                idempotencyKey,
                                context.principal.actorId,
                                operation,
                                hash,
                                IdempotentResponse(
                                    200,
                                    context.idempotentResponseEncoder?.invoke(result.value)
                                        ?: error("Public idempotent response encoder is missing"),
                                ),
                            )
                            result
                        }
                    }
                }
            }
        }
    }
}
