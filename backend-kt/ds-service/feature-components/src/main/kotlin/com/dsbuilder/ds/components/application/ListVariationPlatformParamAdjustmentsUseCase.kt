package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.VariationPlatformParamAdjustment
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Lists accessible variation platform-param adjustments. */
class ListVariationPlatformParamAdjustmentsUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentModelRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext): DsResult<List<VariationPlatformParamAdjustment>> =
        modelList(policy, transactions, context) {
            repository.listVariationAdjustments(context.projectId, context.principal.systemAdmin)
        }
}
