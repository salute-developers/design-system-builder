package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.InvariantPropertyValue
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.TransactionRunner

/** Creates an invariant property value. */
class CreateInvariantPropertyValueUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: PropertyValueRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: PropertyValueRepository.InvariantCreate,
        idempotencyKey: String? = null,
    ): DsResult<InvariantPropertyValue> = modelCreate(
        policy, transactions, repeatedRequests, context, idempotencyKey, "create-invariant-property-value",
        command,
        { repository.findInvariant(context.projectId, context.principal.systemAdmin, it) },
        { repository.createInvariant(context.projectId, context.principal.systemAdmin, command) },
        InvariantPropertyValue::id,
    )
}
