package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Deletes one project-owned design-system version. */
class DeleteDesignSystemVersionUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: DesignSystemVersionRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<Unit> = when (
        val allowed = policy.require(context, "design-systems:delete")
    ) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> transactions.required {
            if (repository.delete(context.projectId, id)) {
                DsResult.Success(Unit)
            } else {
                DsResult.Failure(DsFailure.NotFound)
            }
        }
    }
}
