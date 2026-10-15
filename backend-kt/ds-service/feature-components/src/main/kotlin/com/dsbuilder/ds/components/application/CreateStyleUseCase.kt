package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentStyleSummary
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository

/** Creates a style for a writable design system and variation. */
class CreateStyleUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: StyleRepository,
    private val repeatedRequests: IdempotentRequestRepository,
    private val uniqueKeys: UniqueKeyLockRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: StyleRepository.Create,
        idempotencyKey: String? = null,
    ): DsResult<ComponentStyleSummary> = modelCreate(
        policy, transactions, repeatedRequests, context, idempotencyKey, "create-style", command,
        { repository.findAccessible(context.projectId, context.principal.systemAdmin, it) },
        { repository.createAccessible(context.projectId, context.principal.systemAdmin, command) },
        ComponentStyleSummary::id,
        validateCreate = {
            val normalizedName = command.name.trim().lowercase()
            uniqueKeys.lock(
                command.designSystemId,
                "style",
                "${command.variationId}:$normalizedName",
            )
            if (
                repository.nameExists(
                    context.projectId,
                    context.principal.systemAdmin,
                    command.designSystemId,
                    command.variationId,
                    normalizedName,
                )
            ) {
                DsFailure.Conflict("STYLE_NAME_CONFLICT")
            } else {
                null
            }
        },
    )
}
