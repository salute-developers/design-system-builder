package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentStyleSummary
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Lists styles for an accessible variation and design system. */
class ListStylesByVariationAndDesignSystemUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: StyleRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        variationId: UUID,
        designSystemId: UUID,
    ): DsResult<List<ComponentStyleSummary>> = modelFindList(policy, transactions, context) {
        repository.listByVariationAndDesignSystem(
            context.projectId,
            context.principal.systemAdmin,
            variationId,
            designSystemId,
        )
    }
}
