package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.designsystems.domain.DesignSystem
import com.dsbuilder.ds.designsystems.domain.DesignSystemId

/** Updates one design system owned by the trusted project. */
class UpdateDesignSystemUseCase(
    private val accessPolicy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: DesignSystemRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        id: DesignSystemId,
        command: UpdateDesignSystem,
    ): DsResult<DesignSystem> = when (val authorization = accessPolicy.require(context, "design-systems:write")) {
        is DsResult.Failure -> authorization
        is DsResult.Success -> transactions.required {
            repository.updateOwned(context.projectId, id, command)?.let { DsResult.Success(it) }
                ?: DsResult.Failure(DsFailure.NotFound)
        }
    }
}
