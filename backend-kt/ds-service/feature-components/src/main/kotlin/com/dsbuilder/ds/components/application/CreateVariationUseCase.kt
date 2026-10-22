package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentVariationSummary
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.TransactionRunner

/** Creates a variation for a writable component. */
class CreateVariationUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentModelRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: ComponentModelRepository.VariationCreate,
        idempotencyKey: String? = null,
    ): DsResult<ComponentVariationSummary> = modelCreate(
        policy, transactions, repeatedRequests, context, idempotencyKey, "create-variation", command,
        { repository.findVariation(context.projectId, context.principal.systemAdmin, it) },
        { repository.createVariation(context.projectId, context.principal.systemAdmin, command) },
        ComponentVariationSummary::id,
    )
}
