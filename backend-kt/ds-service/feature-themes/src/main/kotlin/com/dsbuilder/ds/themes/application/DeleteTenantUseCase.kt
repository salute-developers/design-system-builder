package com.dsbuilder.ds.themes.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Deletes one project-owned theme. */
class DeleteTenantUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TenantRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<Unit> = when (
        val allowed = policy.require(context, ProjectScope.TENANTS_DELETE)
    ) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> transactions.required {
            if (repository.deleteOwned(context.projectId, id)) {
                DsResult.Success(Unit)
            } else {
                DsResult.Failure(DsFailure.NotFound)
            }
        }
    }
}
