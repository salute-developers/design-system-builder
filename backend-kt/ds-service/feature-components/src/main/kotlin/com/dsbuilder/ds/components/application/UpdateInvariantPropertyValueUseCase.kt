package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.InvariantPropertyValue
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Updates an invariant property value. */
class UpdateInvariantPropertyValueUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: PropertyValueRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        id: UUID,
        command: PropertyValueRepository.ValueUpdate,
    ): DsResult<InvariantPropertyValue> = modelMutate(policy, transactions, context) {
        repository.updateInvariant(context.projectId, context.principal.systemAdmin, id, command)
    }
}
