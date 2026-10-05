package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.PropertyVariation
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Lists accessible property-to-variation links. */
class ListPropertyVariationsUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentModelRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext): DsResult<List<PropertyVariation>> =
        modelList(policy, transactions, context) {
            repository.listPropertyVariations(context.projectId, context.principal.systemAdmin)
        }
}
