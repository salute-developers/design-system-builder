package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.InvariantPlatformParamAdjustment
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Lists accessible invariant platform-param adjustments. */
class ListInvariantPlatformParamAdjustmentsUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentModelRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext): DsResult<List<InvariantPlatformParamAdjustment>> =
        modelList(policy, transactions, context) {
            repository.listInvariantAdjustments(context.projectId, context.principal.systemAdmin)
        }
}
