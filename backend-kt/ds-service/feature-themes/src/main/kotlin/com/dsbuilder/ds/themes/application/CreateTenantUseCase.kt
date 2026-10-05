package com.dsbuilder.ds.themes.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.domain.Tenant

/** Creates a theme only below an accessible design system. */
class CreateTenantUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TenantRepository,
    private val tokenValueInitializer: TenantTokenValueInitializer,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, command: CreateTenant): DsResult<Tenant> = when (
        val allowed = policy.require(context, ProjectScope.TENANTS_WRITE)
    ) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> transactions.required {
            repository.createOwned(context.projectId, command)?.let { tenant ->
                tokenValueInitializer.initialize(tenant)
                DsResult.Success(tenant)
            }
                ?: DsResult.Failure(DsFailure.NotFound)
        }
    }
}
