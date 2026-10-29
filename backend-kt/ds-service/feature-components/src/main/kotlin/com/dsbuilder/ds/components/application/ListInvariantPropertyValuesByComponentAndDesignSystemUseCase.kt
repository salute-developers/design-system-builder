package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.InvariantPropertyValue
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Lists invariant values by accessible component and design system. */
class ListInvariantPropertyValuesByComponentAndDesignSystemUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: PropertyValueRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        componentId: UUID,
        designSystemId: UUID,
    ): DsResult<List<InvariantPropertyValue>> = modelFindList(policy, transactions, context) {
        repository.listInvariantByComponentAndDesignSystem(
            context.projectId,
            context.principal.systemAdmin,
            componentId,
            designSystemId,
        )
    }
}
