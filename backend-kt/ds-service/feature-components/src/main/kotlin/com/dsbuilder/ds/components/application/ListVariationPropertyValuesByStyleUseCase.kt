package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.VariationPropertyValue
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Lists accessible variation property values by style. */
class ListVariationPropertyValuesByStyleUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: PropertyValueRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, styleId: UUID): DsResult<List<VariationPropertyValue>> =
        modelFindList(policy, transactions, context) {
            repository.listVariationByStyle(context.projectId, context.principal.systemAdmin, styleId)
        }
}
