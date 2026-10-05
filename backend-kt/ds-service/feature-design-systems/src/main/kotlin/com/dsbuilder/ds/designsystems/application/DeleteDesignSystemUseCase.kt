package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.designsystems.domain.DesignSystemId

/** Deletes one design system owned by the trusted project. */
class DeleteDesignSystemUseCase(
    private val accessPolicy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: DesignSystemRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: DesignSystemId): DsResult<Unit> =
        when (val authorization = accessPolicy.require(context, "design-systems:delete")) {
            is DsResult.Failure -> authorization
            is DsResult.Success -> transactions.required {
                if (repository.deleteOwned(context.projectId, id)) {
                    DsResult.Success(Unit)
                } else {
                    DsResult.Failure(DsFailure.NotFound)
                }
            }
        }
}
