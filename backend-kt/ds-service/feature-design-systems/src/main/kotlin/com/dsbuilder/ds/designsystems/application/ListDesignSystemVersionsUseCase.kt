package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersion

/** Lists accessible design-system versions. */
class ListDesignSystemVersionsUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: DesignSystemVersionRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext): DsResult<List<DesignSystemVersion>> = when (
        val allowed = policy.require(context, "design-systems:read")
    ) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> transactions.readOnly { DsResult.Success(repository.list(context.projectId)) }
    }
}
