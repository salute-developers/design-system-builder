package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentState
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Lists global states, optionally filtered by component ownership. */
class ListStatesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: StateRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        componentId: UUID?,
        componentFilterPresent: Boolean,
    ): DsResult<List<ComponentState>> = modelList(policy, transactions, context) {
        repository.list(context.projectId, context.principal.systemAdmin, componentId, componentFilterPresent)
    }
}
