package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.PropertyPlatformParam
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.TransactionRunner

/** Creates a platform param for a writable property. */
class CreatePropertyPlatformParamUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentModelRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: ComponentModelRepository.PlatformParamCreate,
        idempotencyKey: String? = null,
    ): DsResult<PropertyPlatformParam> = modelCreate(
        policy, transactions, repeatedRequests, context, idempotencyKey, "create-property-platform-param",
        command,
        { repository.findPlatformParam(context.projectId, context.principal.systemAdmin, it) },
        { repository.createPlatformParam(context.projectId, context.principal.systemAdmin, command) },
        PropertyPlatformParam::id,
    )
}
