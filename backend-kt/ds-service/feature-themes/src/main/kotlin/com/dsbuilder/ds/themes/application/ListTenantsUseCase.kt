package com.dsbuilder.ds.themes.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.domain.Tenant

/** Lists themes accessible through the trusted project. */
class ListTenantsUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TenantRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext): DsResult<List<Tenant>> = when (
        val allowed = policy.require(context, ProjectScope.TENANTS_READ)
    ) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> transactions.readOnly { DsResult.Success(repository.listAccessible(context.projectId)) }
    }
}
