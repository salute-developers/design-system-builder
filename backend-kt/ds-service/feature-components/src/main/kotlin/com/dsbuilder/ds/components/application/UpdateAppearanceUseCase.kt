package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.Appearance
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository
import java.util.UUID

/** Updates a writable appearance. */
class UpdateAppearanceUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceRepository,
    private val uniqueKeys: UniqueKeyLockRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        id: UUID,
        command: AppearanceRepository.AppearanceUpdate,
    ): DsResult<Appearance> = policy.read(context, ProjectScope.COMPONENT_VARIATIONS_WRITE) {
        transactions.required(context) {
            val current = repository.find(context.projectId, context.principal.systemAdmin, id)
                ?: return@required DsResult.Failure(DsFailure.NotFound)
            if (command.name != null) {
                val normalizedName = command.name.trim().lowercase()
                uniqueKeys.lock(current.designSystemId, "appearance", "${current.componentId}:$normalizedName")
                if (
                    repository.nameExists(
                        context.projectId,
                        context.principal.systemAdmin,
                        current.designSystemId,
                        current.componentId,
                        normalizedName,
                        id,
                    )
                ) {
                    return@required DsResult.Failure(DsFailure.Conflict("APPEARANCE_NAME_CONFLICT"))
                }
            }
            repository.update(context.projectId, context.principal.systemAdmin, id, command)
                ?.let { DsResult.Success(it) } ?: DsResult.Failure(DsFailure.NotFound)
        }
    }
}
