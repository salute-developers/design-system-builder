package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.AppearanceVariation
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.TransactionRunner

/** Creates an appearance variation axis. */
class CreateAppearanceVariationUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: AppearanceRepository.VariationCreate,
        idempotencyKey: String? = null,
    ): DsResult<AppearanceVariation> = modelCreateAxisRoles(
        policy,
        transactions,
        repeatedRequests,
        context,
        idempotencyKey,
        "create-appearance-variation",
        command,
        { repository.findVariation(context.projectId, context.principal.systemAdmin, it) },
        { repository.createVariation(context.projectId, context.principal.systemAdmin, command) },
        AppearanceVariation::id,
    )
}
