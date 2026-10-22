package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.AppearanceVariationValue
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.TransactionRunner

/** Creates an appearance variation value. */
class CreateAppearanceVariationValueUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: AppearanceRepository.ValueCreate,
        idempotencyKey: String? = null,
    ): DsResult<AppearanceVariationValue> = modelCreate(
        policy, transactions, repeatedRequests, context, idempotencyKey, "create-appearance-variation-value",
        command,
        { repository.findValue(context.projectId, context.principal.systemAdmin, it) },
        { repository.createValue(context.projectId, context.principal.systemAdmin, command) },
        AppearanceVariationValue::id,
    )
}
