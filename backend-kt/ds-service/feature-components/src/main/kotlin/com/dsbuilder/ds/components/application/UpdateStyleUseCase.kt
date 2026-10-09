package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentStyleSummary
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Updates a writable component style. */
class UpdateStyleUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: StyleRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        id: UUID,
        command: StyleRepository.Update,
    ): DsResult<ComponentStyleSummary> = modelMutate(policy, transactions, context) {
        repository.updateAccessible(context.projectId, context.principal.systemAdmin, id, command)
    }
}
