package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentPropertySummary
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Lists properties linked to one accessible variation. */
class ListVariationPropertiesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentModelRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<List<ComponentPropertySummary>> =
        modelFindList(policy, transactions, context) {
            repository.variationProperties(context.projectId, context.principal.systemAdmin, id)
        }
}
