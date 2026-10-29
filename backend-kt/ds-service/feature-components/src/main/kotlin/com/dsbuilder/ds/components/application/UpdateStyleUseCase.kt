package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ComponentStyleSummary
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository
import java.util.UUID

/** Updates a writable component style. */
class UpdateStyleUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: StyleRepository,
    private val uniqueKeys: UniqueKeyLockRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        id: UUID,
        command: StyleRepository.Update,
    ): DsResult<ComponentStyleSummary> = policy.read(context, ProjectScope.COMPONENT_VARIATIONS_WRITE) {
        transactions.required(context) {
            val current = repository.findAccessible(context.projectId, context.principal.systemAdmin, id)
                ?: return@required DsResult.Failure(DsFailure.NotFound)
            if (command.name != null) {
                val normalizedName = command.name.trim().lowercase()
                uniqueKeys.lock(current.designSystemId, "style", "${current.variationId}:$normalizedName")
                if (
                    repository.nameExists(
                        context.projectId,
                        context.principal.systemAdmin,
                        current.designSystemId,
                        current.variationId,
                        normalizedName,
                        id,
                    )
                ) {
                    return@required DsResult.Failure(DsFailure.Conflict("STYLE_NAME_CONFLICT"))
                }
            }
            repository.updateAccessible(context.projectId, context.principal.systemAdmin, id, command)
                ?.let { DsResult.Success(it) } ?: DsResult.Failure(DsFailure.NotFound)
        }
    }
}
