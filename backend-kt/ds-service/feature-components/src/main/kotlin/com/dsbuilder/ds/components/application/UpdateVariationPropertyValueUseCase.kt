package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.VariationPropertyValue
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Updates a variation property value. */
class UpdateVariationPropertyValueUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: PropertyValueRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        id: UUID,
        command: PropertyValueRepository.ValueUpdate,
    ): DsResult<VariationPropertyValue> = modelMutate(policy, transactions, context) {
        repository.updateVariation(context.projectId, context.principal.systemAdmin, id, command)
    }
}
