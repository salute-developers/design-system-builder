package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.VariationPlatformParamAdjustment
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.TransactionRunner

/** Creates a variation platform-param adjustment. */
class CreateVariationPlatformParamAdjustmentUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentModelRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: ComponentModelRepository.VariationAdjustmentCreate,
        idempotencyKey: String? = null,
    ): DsResult<VariationPlatformParamAdjustment> = modelCreate(
        policy, transactions, repeatedRequests, context, idempotencyKey, "create-variation-platform-adjustment",
        command,
        { repository.findVariationAdjustment(context.projectId, context.principal.systemAdmin, it) },
        { repository.createVariationAdjustment(context.projectId, context.principal.systemAdmin, command) },
        VariationPlatformParamAdjustment::id,
    )
}
