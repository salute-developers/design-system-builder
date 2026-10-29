package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.StyleCombination
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.TransactionRunner

/** Creates an accessible style combination. */
class CreateStyleCombinationUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: StyleCombinationRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: StyleCombinationRepository.Create,
        idempotencyKey: String? = null,
    ): DsResult<StyleCombination> = modelCreate(
        policy, transactions, repeatedRequests, context, idempotencyKey, "create-style-combination", command,
        { repository.find(context.projectId, context.principal.systemAdmin, it) },
        { repository.create(context.projectId, context.principal.systemAdmin, command) },
        StyleCombination::id,
    )
}
