package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentStateSet
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Gets one canonical state set. */
class GetStateSetUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: StateRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<ComponentStateSet> =
        modelFind(policy, transactions, context) {
            repository.findSet(context.projectId, context.principal.systemAdmin, id)
        }
}
