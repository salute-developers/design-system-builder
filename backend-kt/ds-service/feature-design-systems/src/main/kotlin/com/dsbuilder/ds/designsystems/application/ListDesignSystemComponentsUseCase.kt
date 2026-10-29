package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadTarget
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
        is DsResult.Success -> transactions.readOnly(
            context,
            ModelReadTarget(ModelReadTarget.Kind.DESIGN_SYSTEM, id.value),
        ) { selected ->
            repository.pageComponents(selected.projectId, id, query, selected.readQuery)
                ?.let { DsResult.Success(it.items, readPage = it.page) }
                ?: DsResult.Failure(DsFailure.NotFound)
        }
    }
}
