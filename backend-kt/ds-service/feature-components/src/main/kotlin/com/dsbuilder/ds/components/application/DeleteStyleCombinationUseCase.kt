package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Deletes an accessible style combination. */
class DeleteStyleCombinationUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: StyleCombinationRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<Unit> =
        modelDelete(policy, transactions, context) {
            repository.delete(context.projectId, context.principal.systemAdmin, id)
        }
}
