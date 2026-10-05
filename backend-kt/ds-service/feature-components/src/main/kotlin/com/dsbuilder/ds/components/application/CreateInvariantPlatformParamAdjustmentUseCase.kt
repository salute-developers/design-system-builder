package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.InvariantPlatformParamAdjustment
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Creates an invariant platform-param adjustment. */
class CreateInvariantPlatformParamAdjustmentUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentModelRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: ComponentModelRepository.InvariantAdjustmentCreate,
    ): DsResult<InvariantPlatformParamAdjustment> = modelMutate(policy, transactions, context) {
        repository.createInvariantAdjustment(context.projectId, context.principal.systemAdmin, command)
    }
}
