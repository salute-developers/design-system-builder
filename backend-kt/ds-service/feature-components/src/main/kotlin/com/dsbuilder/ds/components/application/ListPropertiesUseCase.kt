package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentPropertySummary
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Lists properties accessible through project components. */
class ListPropertiesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentModelRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext): DsResult<List<ComponentPropertySummary>> =
        modelList(policy, transactions, context) {
            repository.listProperties(context.projectId, context.principal.systemAdmin)
        }
}
