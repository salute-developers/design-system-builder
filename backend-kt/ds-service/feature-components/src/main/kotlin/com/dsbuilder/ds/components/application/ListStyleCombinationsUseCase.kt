package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.StyleCombination
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Lists accessible style combinations. */
class ListStyleCombinationsUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: StyleCombinationRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext): DsResult<List<StyleCombination>> =
        modelList(policy, transactions, context) {
            repository.list(context.projectId, context.principal.systemAdmin)
        }
}
