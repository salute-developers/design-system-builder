package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.Component
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Updates a component through its writable design-system ownership chain. */
class UpdateComponentUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        id: UUID,
        command: ComponentRepository.Update,
    ): DsResult<Component> = policy.read(context, ProjectScope.COMPONENTS_WRITE) {
        transactions.required {
            repository.updateAccessible(context.projectId, context.principal.systemAdmin, id, command)
                ?.let { DsResult.Success(it) } ?: DsResult.Failure(DsFailure.NotFound)
        }
    }
}
