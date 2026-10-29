package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentPropertySummary
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Updates a writable property. */
class UpdatePropertyUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentModelRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        id: UUID,
        command: ComponentModelRepository.PropertyUpdate,
    ): DsResult<ComponentPropertySummary> = modelMutate(policy, transactions, context) {
        repository.updateProperty(context.projectId, context.principal.systemAdmin, id, command)
    }
}
