package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.InvariantPropertyValue
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Lists accessible invariant property values. */
class ListInvariantPropertyValuesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: PropertyValueRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext): DsResult<List<InvariantPropertyValue>> =
        modelList(policy, transactions, context) {
            repository.listInvariant(context.projectId, context.principal.systemAdmin)
        }
}
