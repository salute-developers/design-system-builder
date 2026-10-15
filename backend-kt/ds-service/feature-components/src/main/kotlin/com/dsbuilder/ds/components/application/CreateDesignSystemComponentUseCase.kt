package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.DesignSystemComponent
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Links a component to a writable design system. */
class CreateDesignSystemComponentUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: DesignSystemComponentRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        designSystemId: UUID,
        componentId: UUID,
        idempotencyKey: String? = null,
    ): DsResult<DesignSystemComponent> = modelCreate(
        policy, transactions, repeatedRequests, context, idempotencyKey, "create-design-system-component",
        "$designSystemId:$componentId",
        { repository.findAccessible(context.projectId, context.principal.systemAdmin, it) },
        { repository.createOwned(context.projectId, context.principal.systemAdmin, designSystemId, componentId) },
        DesignSystemComponent::id,
    )
}
