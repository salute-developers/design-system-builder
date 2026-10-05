package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.DesignSystemComponent
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Links a component to a writable design system. */
class CreateDesignSystemComponentUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: DesignSystemComponentRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        designSystemId: UUID,
        componentId: UUID,
    ): DsResult<DesignSystemComponent> = policy.read(context, ProjectScope.COMPONENTS_WRITE) {
        transactions.required {
            repository.createOwned(context.projectId, context.principal.systemAdmin, designSystemId, componentId)
                ?.let { DsResult.Success(it) } ?: DsResult.Failure(DsFailure.NotFound)
        }
    }
}
