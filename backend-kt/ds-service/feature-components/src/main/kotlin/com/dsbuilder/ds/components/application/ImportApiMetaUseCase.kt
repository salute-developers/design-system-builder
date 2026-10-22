package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ApiMetaImportReport
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

/**
 * Imports an API-meta manifest into the global component layer in one transaction.
 *
 * The layer is shared by every design system of every project, so the operation is reserved for a
 * trusted system administrator. A dry run performs the whole work and rolls it back, so the report
 * matches what an applied import would do.
 */
class ImportApiMetaUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ApiMetaRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: ImportApiMeta,
        idempotencyKey: String? = null,
    ): DsResult<ApiMetaImportReport> {
        if (!context.principal.systemAdmin) return DsResult.Failure(DsFailure.Forbidden)
        if (idempotencyKey != null && idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
            return DsResult.Failure(DsFailure.InvalidRequest("idempotency_key_too_long"))
        }
        return policy.read(context, ProjectScope.COMPONENTS_WRITE) {
            val execute = suspend {
                when (val attempt = repository.import(command)) {
                    is ApiMetaRepository.ImportAttempt.Success -> DsResult.Success(attempt.value)
                    is ApiMetaRepository.ImportAttempt.Failed -> DsResult.Failure(
                        DsFailure.Unprocessable("Import failed", attempt.reason),
                    )
                }
            }
            if (command.dryRun) {
                transactions.rollback(execute)
            } else {
                transactions.required {
                    if (idempotencyKey.isNullOrBlank()) return@required execute()
                    val operation = "import-component-api-meta"
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
}
