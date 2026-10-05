package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.designsystems.domain.DesignSystem

/** Lists design systems accessible to the trusted project. */
class ListDesignSystemsUseCase(
    private val accessPolicy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: DesignSystemRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext): DsResult<List<DesignSystem>> =
        when (val authorization = accessPolicy.require(context, "design-systems:read")) {
            is DsResult.Failure -> authorization
            is DsResult.Success -> transactions.readOnly {
                DsResult.Success(repository.listAccessible(context.projectId))
            }
        }
}
