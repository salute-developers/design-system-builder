package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentVariationSummary
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Lists variation axes of accessible design systems, optionally of one design system. */
class ListVariationsUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentModelRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        designSystemId: UUID? = null,
    ): DsResult<List<ComponentVariationSummary>> =
        modelList(policy, transactions, context) {
            repository.listVariations(context.projectId, context.principal.systemAdmin, designSystemId)
        }
}
