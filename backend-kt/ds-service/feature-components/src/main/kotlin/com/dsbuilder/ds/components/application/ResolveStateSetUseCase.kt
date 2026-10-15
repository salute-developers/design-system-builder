package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ResolvedStateSet
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
import java.util.UUID

/** Resolves a canonical state set, creating it when absent. */
class ResolveStateSetUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: StateRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        stateIds: List<UUID>,
        idempotencyKey: String? = null,
    ): DsResult<ResolvedStateSet> {
        if (!context.principal.systemAdmin) return DsResult.Failure(DsFailure.Forbidden)
        if (idempotencyKey != null && idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
            return DsResult.Failure(DsFailure.InvalidRequest("idempotency_key_too_long"))
        }
        return policy.read(context, ProjectScope.COMPONENT_VARIATIONS_WRITE) {
            transactions.required(context) {
                val operation = "resolve-state-set"
                val hash = RequestHash.canonical(stateIds)
                if (!idempotencyKey.isNullOrBlank()) {
                    when (val previous = repeatedRequests.lookup(context.projectId, idempotencyKey, operation, hash)) {
                        IdempotentRequestLookup.PayloadMismatch ->
                            return@required DsResult.Failure(DsFailure.Conflict("IDEMPOTENCY_KEY_REUSED"))
                        is IdempotentRequestLookup.Replayed -> throw IdempotentReplayException(previous.response)
                        IdempotentRequestLookup.New -> Unit
                    }
                }
                when (val resolution = repository.resolve(stateIds)) {
                    is StateRepository.Resolution.Success -> {
                        if (!idempotencyKey.isNullOrBlank()) {
                            repeatedRequests.save(
                                context.projectId,
                                idempotencyKey,
                                context.principal.actorId,
                                operation,
                                hash,
                                IdempotentResponse(
                                    if (resolution.value.created) 201 else 200,
                                    context.idempotentResponseEncoder?.invoke(resolution.value)
                                        ?: "\"${resolution.value.value.id}\"",
                                ),
                            )
                        }
                        DsResult.Success(resolution.value)
                    }
                    is StateRepository.Resolution.Invalid -> DsResult.Failure(
                        DsFailure.InvalidRequest("invalid_state_set", mapOf("reason" to resolution.reason)),
                    )
                }
            }
        }
    }
}
