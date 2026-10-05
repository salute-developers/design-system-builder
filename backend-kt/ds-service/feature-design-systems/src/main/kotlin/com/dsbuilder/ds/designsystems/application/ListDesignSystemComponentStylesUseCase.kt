package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemStyleSummary
import java.util.UUID

/** Lists styles for a component linked to an accessible design system. */
class ListDesignSystemComponentStylesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: DesignSystemAggregateRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        id: DesignSystemId,
        componentId: UUID,
    ): DsResult<List<DesignSystemStyleSummary>> = when (
        val allowed = policy.require(
            context,
            ProjectScope.COMPONENTS_READ,
        )
    ) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> transactions.readOnly {
            repository.listComponentStyles(context.projectId, id, componentId)?.let { DsResult.Success(it) }
                ?: DsResult.Failure(DsFailure.NotFound)
        }
    }
}
