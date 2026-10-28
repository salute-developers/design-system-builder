package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentVariationSummary
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository

/** Creates a variation axis for a writable design system and component. */
class CreateVariationUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentModelRepository,
    private val repeatedRequests: IdempotentRequestRepository,
    private val uniqueKeys: UniqueKeyLockRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: ComponentModelRepository.VariationCreate,
        idempotencyKey: String? = null,
    ): DsResult<ComponentVariationSummary> = modelCreate(
        policy, transactions, repeatedRequests, context, idempotencyKey, "create-variation", command,
        { repository.findVariation(context.projectId, context.principal.systemAdmin, it) },
        { repository.createVariation(context.projectId, context.principal.systemAdmin, command) },
        ComponentVariationSummary::id,
        validateCreate = {
            val normalizedName = command.name.trim().lowercase()
            if (!repository.canCreateVariation(
                    context.projectId,
                    context.principal.systemAdmin,
                    command.designSystemId,
                    command.componentId,
                )
            ) {
                return@modelCreate DsFailure.NotFound
            }
            uniqueKeys.lock(command.designSystemId, "variation", "${command.componentId}:$normalizedName")
            if (repository.variationNameExists(command.designSystemId, command.componentId, normalizedName)) {
                DsFailure.Conflict("VARIATION_NAME_CONFLICT")
            } else {
                null
            }
        },
    )
}
