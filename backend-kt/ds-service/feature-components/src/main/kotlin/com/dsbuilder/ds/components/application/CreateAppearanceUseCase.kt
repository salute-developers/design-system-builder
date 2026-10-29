package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.Appearance
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository

/** Creates an appearance in a writable design system. */
class CreateAppearanceUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceRepository,
    private val repeatedRequests: IdempotentRequestRepository,
    private val uniqueKeys: UniqueKeyLockRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: AppearanceRepository.AppearanceCreate,
        idempotencyKey: String? = null,
    ): DsResult<Appearance> = modelCreate(
        policy, transactions, repeatedRequests, context, idempotencyKey, "create-appearance", command,
        { repository.find(context.projectId, context.principal.systemAdmin, it) },
        { repository.create(context.projectId, context.principal.systemAdmin, command) },
        Appearance::id,
        validateCreate = {
            val normalizedName = command.name?.trim()?.lowercase()
            uniqueKeys.lock(command.designSystemId, "appearance-default", command.componentId.toString())
            uniqueKeys.lock(
                command.designSystemId,
                "appearance",
                "${command.componentId}:${normalizedName ?: "<null>"}",
            )
            if (
                repository.nameExists(
                    context.projectId,
                    context.principal.systemAdmin,
                    command.designSystemId,
                    command.componentId,
                    normalizedName,
                )
            ) {
                DsFailure.Conflict("APPEARANCE_NAME_CONFLICT")
            } else {
                null
            }
        },
    )
}
