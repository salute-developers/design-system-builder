package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.StateImpact
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Calculates the cascade impact of deleting a state. */
class GetStateImpactUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: StateRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<StateImpact> =
        modelFind(policy, transactions, context) {
            repository.impact(context.projectId, context.principal.systemAdmin, id)
        }
}
