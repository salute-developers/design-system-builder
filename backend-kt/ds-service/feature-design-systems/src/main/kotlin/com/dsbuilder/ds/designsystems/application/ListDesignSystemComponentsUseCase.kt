package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.designsystems.domain.DesignSystemComponentSummary
import com.dsbuilder.ds.designsystems.domain.DesignSystemId

/** Lists component summaries linked to an accessible design system. */
class ListDesignSystemComponentsUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: DesignSystemAggregateRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        id: DesignSystemId,
        query: String?,
    ): DsResult<List<DesignSystemComponentSummary>> = when (
        val allowed = policy.require(
            context,
            ProjectScope.COMPONENTS_READ,
        )
    ) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> transactions.readOnly {
            repository.listComponents(context.projectId, id, query)?.let { DsResult.Success(it) }
                ?: DsResult.Failure(DsFailure.NotFound)
        }
    }
}
