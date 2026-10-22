package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentPropertySummary
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.TransactionRunner

/** Creates a property for a writable component or, for system admins, a global property. */
class CreatePropertyUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentModelRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: ComponentModelRepository.PropertyCreate,
        idempotencyKey: String? = null,
    ): DsResult<ComponentPropertySummary> = modelCreate(
        policy, transactions, repeatedRequests, context, idempotencyKey, "create-property", command,
        { repository.findProperty(context.projectId, context.principal.systemAdmin, it) },
        { repository.createProperty(context.projectId, context.principal.systemAdmin, command) },
        ComponentPropertySummary::id,
    )
}
