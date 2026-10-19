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
        paths: Set<String> = emptySet(),
    ): DsResult<Unit> = if (idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
        DsResult.Failure(DsFailure.InvalidRequest("idempotency_key_too_long"))
    } else if (!validPaths(paths)) {
        DsResult.Failure(DsFailure.InvalidRequest("invalid_revert_paths"))
    } else {
        when (val allowed = policy.require(context, "design-systems:write")) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.required(context) {
                val operation = "revert-draft-change"
                val hashParts = listOf(designSystemId.value, changeId, expectedRevision)
                val hash = RequestHash.canonical(if (paths.isEmpty()) hashParts else hashParts + paths.sorted())
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
                        paths,
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
                    else -> failure(result)
                }
            }
        }
    }

    private fun validPaths(paths: Set<String>): Boolean =
        paths.size <= 32 && paths.all { it.length <= 256 && valuePath(it) }

    private fun valuePath(path: String): Boolean = path == "/value" || path.startsWith("/value/")

    private fun failure(result: DraftChangeRevertResult): DsResult.Failure = DsResult.Failure(
        when (result) {
            DraftChangeRevertResult.NotFound -> DsFailure.NotFound
            DraftChangeRevertResult.InvalidPaths -> DsFailure.InvalidRequest("invalid_revert_paths")
            DraftChangeRevertResult.DependencyConflict -> DsFailure.Conflict("REVERT_DEPENDENCY_CONFLICT")
            DraftChangeRevertResult.LimitExceeded -> DsFailure.Unprocessable(
                code = "JOURNAL_LIMIT_EXCEEDED",
                message = "The journal exceeds the supported limit of 10000 changes",
            )
            is DraftChangeRevertResult.Stale -> DsFailure.Conflict("DRAFT_CHANGE_STALE", result.currentRevision.toInt())
            DraftChangeRevertResult.Reverted -> error("Successful revert has no failure")
        },
    )
}
