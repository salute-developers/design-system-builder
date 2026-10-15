package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ComponentState
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentCreateExecutor
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.TransactionRunner

/** Creates a state as a system administrator. */
class CreateStateUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: StateRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: StateRepository.Create,
        idempotencyKey: String? = null,
    ): DsResult<ComponentState> {
        if (!context.principal.systemAdmin) return DsResult.Failure(DsFailure.Forbidden)
        return policy.read(context, ProjectScope.COMPONENT_VARIATIONS_WRITE) {
            transactions.required(context) {
                IdempotentCreateExecutor(repeatedRequests).execute(
                    context,
                    idempotencyKey,
                    "create-state",
                    command,
                    { repository.find(context.projectId, true, it) },
                    { repository.create(command) },
                    ComponentState::id,
                )
            }
        }
    }
}
