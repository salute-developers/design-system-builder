package com.dsbuilder.ds.themes.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.domain.Tenant
import java.util.UUID

/** Updates one project-owned theme. */
class UpdateTenantUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TenantRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID, command: UpdateTenant): DsResult<Tenant> =
        when (val allowed = policy.require(context, ProjectScope.TENANTS_WRITE)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.required {
                repository.updateOwned(context.projectId, id, command)?.let { DsResult.Success(it) }
                    ?: DsResult.Failure(DsFailure.NotFound)
            }
        }
}
