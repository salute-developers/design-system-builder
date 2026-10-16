package com.dsbuilder.ds.designsystems.application

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
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DraftChangeRevertResult
import java.util.UUID

/** Откатывает одно актуальное изменение активного черновика. */
class RevertDraftChangeUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: DraftChangeRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Проверяет редакцию и повторяемость, затем откатывает изменение. */
    suspend fun execute(
        context: DsRequestContext,
        designSystemId: DesignSystemId,
        changeId: UUID,
        expectedRevision: Long,
        idempotencyKey: String,
    ): DsResult<Unit> = if (idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
        DsResult.Failure(DsFailure.InvalidRequest("idempotency_key_too_long"))
    } else {
        when (val allowed = policy.require(context, "design-systems:write")) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.required(context) {
                val operation = "revert-draft-change"
                val hash = RequestHash.canonical(listOf(designSystemId.value, changeId, expectedRevision))
                when (val previous = repeatedRequests.lookup(context.projectId, idempotencyKey, operation, hash)) {
                    IdempotentRequestLookup.PayloadMismatch ->
                        return@required DsResult.Failure(DsFailure.Conflict("IDEMPOTENCY_KEY_REUSED"))
                    is IdempotentRequestLookup.Replayed -> throw IdempotentReplayException(previous.response)
                    IdempotentRequestLookup.New -> Unit
                }
                when (
                    val result = repository.revert(
                        context.projectId,
                        context.principal.systemAdmin,
                        designSystemId,
                        changeId,
                        expectedRevision,
                    )
                ) {
                    DraftChangeRevertResult.Reverted -> {
                        repeatedRequests.save(
                            context.projectId,
                            idempotencyKey,
                            context.principal.actorId,
                            operation,
                            hash,
                            IdempotentResponse(
                                200,
                                context.idempotentResponseEncoder?.invoke(Unit)
                                    ?: error("Public idempotent response encoder is missing"),
                            ),
                        )
                        DsResult.Success(Unit)
                    }
                    DraftChangeRevertResult.NotFound -> DsResult.Failure(DsFailure.NotFound)
                    DraftChangeRevertResult.DependencyConflict ->
                        DsResult.Failure(DsFailure.Conflict("REVERT_DEPENDENCY_CONFLICT"))
                    DraftChangeRevertResult.LimitExceeded ->
                        DsResult.Failure(
                            DsFailure.Unprocessable(
                                code = "JOURNAL_LIMIT_EXCEEDED",
                                message = "The journal exceeds the supported limit of 10000 changes",
                            ),
                        )
                    is DraftChangeRevertResult.Stale ->
                        DsResult.Failure(DsFailure.Conflict("DRAFT_CHANGE_STALE", result.currentRevision.toInt()))
                }
            }
        }
    }
}
