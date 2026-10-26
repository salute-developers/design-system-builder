package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadTarget
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemTokenSummary

/** Lists token summaries linked to an accessible design system. */
class ListDesignSystemTokensUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: DesignSystemAggregateRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        id: DesignSystemId,
        type: String?,
        query: String?,
    ): DsResult<List<DesignSystemTokenSummary>> = when (
        val allowed = policy.require(
            context,
            ProjectScope.TOKENS_READ,
        )
    ) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> transactions.readOnly(
            context,
            ModelReadTarget(ModelReadTarget.Kind.DESIGN_SYSTEM, id.value),
        ) { selected ->
            repository.pageTokens(selected.projectId, id, type, query, selected.readQuery)
                ?.let { DsResult.Success(it.items, readPage = it.page) }
                ?: DsResult.Failure(DsFailure.NotFound)
        }
    }
}
