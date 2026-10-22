package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.PropertyVariation
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.TransactionRunner

/** Links a writable property to a writable variation. */
class CreatePropertyVariationUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentModelRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: ComponentModelRepository.PropertyVariationCreate,
        idempotencyKey: String? = null,
    ): DsResult<PropertyVariation> = modelCreate(
        policy, transactions, repeatedRequests, context, idempotencyKey, "create-property-variation",
        command,
        { repository.findPropertyVariation(context.projectId, context.principal.systemAdmin, it) },
        { repository.createPropertyVariation(context.projectId, context.principal.systemAdmin, command) },
        PropertyVariation::id,
    )
}
