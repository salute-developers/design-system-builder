package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.VariationPropertyValue
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Creates a variation property value. */
class CreateVariationPropertyValueUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: PropertyValueRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: PropertyValueRepository.VariationCreate,
    ): DsResult<VariationPropertyValue> = modelMutate(policy, transactions, context) {
        repository.createVariation(context.projectId, context.principal.systemAdmin, command)
    }
}
