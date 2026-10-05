package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.VariationPropertyValue
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Reads one accessible variation property value. */
class GetVariationPropertyValueUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: PropertyValueRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<VariationPropertyValue> =
        modelFind(policy, transactions, context) {
            repository.findVariation(context.projectId, context.principal.systemAdmin, id)
        }
}
